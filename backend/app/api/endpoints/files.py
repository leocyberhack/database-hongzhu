"""
文件系统 API - 支持文件夹和文件管理
"""
from collections import Counter
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query, Header
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update, delete
from app.api.auth import User, require_roles
from app.core.storage import upload_file, delete_file
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.utils.time import now_china
from app.models import Folder, File as FileModel, AuditLog

router = APIRouter()


class BatchFileIdsPayload(BaseModel):
    file_ids: List[int] = []


class BatchMovePayload(BatchFileIdsPayload):
    folder_id: Optional[int] = None


class BatchFolderIdsPayload(BaseModel):
    folder_ids: List[int] = []


class BatchFolderMovePayload(BatchFolderIdsPayload):
    parent_id: Optional[int] = None


class FolderPasswordPayload(BaseModel):
    password: str


def _build_children_map(folders: List[Folder]) -> dict[Optional[int], List[Folder]]:
    children_map: dict[Optional[int], List[Folder]] = {}
    for folder in folders:
        children_map.setdefault(folder.parent_id, []).append(folder)
    return children_map


def _collect_descendant_ids(root_ids: List[int], children_map: dict[Optional[int], List[Folder]]) -> List[int]:
    descendants: set[int] = set()
    stack = list(root_ids)
    while stack:
        current_id = stack.pop()
        if current_id in descendants:
            continue
        descendants.add(current_id)
        for child in children_map.get(current_id, []):
            stack.append(child.id)
    return list(descendants)


def _require_folder_password(folder: Folder, password: Optional[str]) -> None:
    if not folder.password_hash:
        return
    if not password:
        raise HTTPException(status_code=403, detail="请输入密码")
    if not verify_password(password, folder.password_hash):
        raise HTTPException(status_code=403, detail="密码错误")


async def _delete_folders_with_files(db: AsyncSession, folder_ids: List[int], operator: str) -> dict:
    result = await db.execute(select(Folder))
    all_folders = result.scalars().all()
    folder_map = {folder.id: folder for folder in all_folders}
    missing_ids = [folder_id for folder_id in folder_ids if folder_id not in folder_map]
    if missing_ids:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    children_map = _build_children_map(all_folders)
    descendant_ids = _collect_descendant_ids(folder_ids, children_map)

    files_result = await db.execute(select(FileModel).where(FileModel.folder_id.in_(descendant_ids)))
    files = files_result.scalars().all()
    operated_at = now_china()
    for f in files:
        db.add(
            AuditLog(
                table_name="file",
                record_id=f.id,
                operation="DELETE",
                diff_data={
                    "filename": f.filename,
                    "object_name": f.object_name,
                    "content_type": f.content_type,
                    "size": f.size,
                    "folder_id": f.folder_id,
                    "url": f.url,
                },
                operator=operator,
                operated_at=operated_at,
                source="web",
            )
        )

    descendant_folders = [folder_map[folder_id] for folder_id in descendant_ids if folder_id in folder_map]
    for folder in descendant_folders:
        db.add(
            AuditLog(
                table_name="folder",
                record_id=folder.id,
                operation="DELETE",
                diff_data={
                    "name": folder.name,
                    "parent_id": folder.parent_id,
                },
                operator=operator,
                operated_at=operated_at,
                source="web",
            )
        )

    # Delete from storage first; abort if any deletion fails
    failed = []
    for f in files:
        if not delete_file(f.object_name):
            failed.append(f.filename)
    if failed:
        preview = failed[:5]
        raise HTTPException(
            status_code=502,
            detail=f"部分文件删除失败，未清理数据库记录: {preview}" + ("..." if len(failed) > 5 else ""),
        )

    await db.execute(delete(FileModel).where(FileModel.folder_id.in_(descendant_ids)))
    await db.execute(delete(Folder).where(Folder.id.in_(descendant_ids)))
    return {"deleted_folders": len(descendant_ids), "deleted_files": len(files)}

# ==================== 文件夹 API ====================

@router.get("/folders")
async def list_folders(
    parent_id: Optional[int] = Query(None, description="父文件夹ID，为空表示根目录"),
    x_folder_password: Optional[str] = Header(default=None, alias="X-Folder-Password"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """获取文件夹列表"""
    if parent_id:
        parent = await db.get(Folder, parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        _require_folder_password(parent, x_folder_password)
        query = select(Folder).where(Folder.parent_id == parent_id)
    else:
        # 根目录：排除POI/供应商专属文件夹（名称以"POI_"/"SUPPLIER_"开头的文件夹）
        query = select(Folder).where(
            and_(
                Folder.parent_id.is_(None),
                ~Folder.name.startswith("POI_"),
                ~Folder.name.startswith("SUPPLIER_"),
            )
        )
    
    result = await db.execute(query.order_by(Folder.name))
    folders = result.scalars().all()
    
    return [{
        "id": f.id,
        "name": f.name,
        "parent_id": f.parent_id,
        "created_by": f.created_by,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "has_password": bool(f.password_hash),
    } for f in folders]


@router.get("/folders/all")
async def list_all_folders(
    include_private: bool = Query(default=False, description="????POI/????????"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """?????????????"""
    result = await db.execute(select(Folder).order_by(Folder.name))
    folders = result.scalars().all()
    if not include_private and folders:
        private_roots = [
            f for f in folders
            if f.name.startswith("POI_") or f.name.startswith("SUPPLIER_")
        ]
        if private_roots:
            children_map = _build_children_map(folders)
            private_ids = set(_collect_descendant_ids([f.id for f in private_roots], children_map))
            folders = [f for f in folders if f.id not in private_ids]
    return [{
        "id": f.id,
        "name": f.name,
        "parent_id": f.parent_id,
        "created_by": f.created_by,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "has_password": bool(f.password_hash),
    } for f in folders]

@router.post("/folders")
async def create_folder(
    name: str,
    parent_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """创建文件夹"""
    # 检查同名文件夹
    existing = await db.execute(
        select(Folder).where(and_(Folder.name == name, Folder.parent_id == parent_id))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="同名文件夹已存在")
    
    folder = Folder(name=name, parent_id=parent_id, created_by=user.username)
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    
    return {"id": folder.id, "name": folder.name, "parent_id": folder.parent_id}


@router.put("/folders/{folder_id}")
async def rename_folder(
    folder_id: int,
    name: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """重命名文件夹"""
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    
    # 检查同名
    existing = await db.execute(
        select(Folder).where(and_(
            Folder.name == name, 
            Folder.parent_id == folder.parent_id,
            Folder.id != folder_id
        ))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="同名文件夹已存在")
    
    folder.name = name
    await db.commit()
    return {"message": "重命名成功", "id": folder.id, "name": folder.name}


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """删除文件夹（包括其中的所有文件和子文件夹）"""
    await _delete_folders_with_files(db, [folder_id], user.username)
    await db.commit()
    return {"message": "文件夹删除成功"}


@router.post("/folders/{folder_id}/password")
async def set_folder_password(
    folder_id: int,
    payload: FolderPasswordPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """设置文件夹密码（仅未设置时）"""
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    if folder.password_hash:
        raise HTTPException(status_code=400, detail="文件夹已设置密码")
    if not payload.password.strip():
        raise HTTPException(status_code=400, detail="密码不能为空")

    audit = AuditLog(
        table_name="folder",
        record_id=folder.id,
        operation="UPDATE",
        diff_data={
            "before": {"name": folder.name, "has_password": False},
            "after": {"name": folder.name, "has_password": True},
        },
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    folder.password_hash = hash_password(payload.password)
    await db.commit()
    return {"message": "设置密码成功"}


@router.post("/folders/{folder_id}/password/reset")
async def reset_folder_password(
    folder_id: int,
    payload: FolderPasswordPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["super_admin"]))
):
    """重置文件夹密码（超级管理员）"""
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    if not payload.password.strip():
        raise HTTPException(status_code=400, detail="密码不能为空")

    folder.password_hash = hash_password(payload.password)
    await db.commit()
    return {"message": "重置密码成功"}


@router.delete("/folders/{folder_id}/password")
async def delete_folder_password(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["super_admin"]))
):
    """删除文件夹密码（超级管理员）"""
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    folder.password_hash = None
    await db.commit()
    return {"message": "删除密码成功"}


@router.post("/folders/{folder_id}/verify")
async def verify_folder_password(
    folder_id: int,
    payload: FolderPasswordPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """校验文件夹密码"""
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    _require_folder_password(folder, payload.password)
    return {"verified": True, "has_password": bool(folder.password_hash)}


@router.post("/folders/batch-delete", status_code=204)
async def batch_delete_folders(
    payload: BatchFolderIdsPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """批量删除文件夹（包含子文件夹和文件）"""
    folder_ids = list({int(fid) for fid in payload.folder_ids})
    if not folder_ids:
        raise HTTPException(status_code=400, detail="请选择要删除的文件夹")

    await _delete_folders_with_files(db, folder_ids, user.username)
    await db.commit()
    return None


@router.post("/folders/batch-move")
async def batch_move_folders(
    payload: BatchFolderMovePayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """批量移动文件夹到指定父文件夹"""
    folder_ids = list({int(fid) for fid in payload.folder_ids})
    if not folder_ids:
        raise HTTPException(status_code=400, detail="请选择要移动的文件夹")

    result = await db.execute(select(Folder))
    all_folders = result.scalars().all()
    folder_map = {folder.id: folder for folder in all_folders}
    missing_ids = [folder_id for folder_id in folder_ids if folder_id not in folder_map]
    if missing_ids:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    if payload.parent_id is not None:
        target_folder = folder_map.get(payload.parent_id)
        if not target_folder:
            raise HTTPException(status_code=404, detail="目标文件夹不存在")

        # 防止移动到自身或子孙目录
        current_id = payload.parent_id
        while current_id:
            if current_id in folder_ids:
                raise HTTPException(status_code=400, detail="不能移动到自身或子文件夹中")
            current_folder = folder_map.get(current_id)
            if not current_folder:
                break
            current_id = current_folder.parent_id

    await db.execute(
        update(Folder)
        .where(Folder.id.in_(folder_ids))
        .values(parent_id=payload.parent_id)
    )
    await db.commit()
    return {"moved": len(folder_ids), "parent_id": payload.parent_id}


@router.get("/folders/{folder_id}/path")
async def get_folder_path(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """获取文件夹的完整路径（面包屑导航）"""
    path = []
    current_id = folder_id
    
    while current_id:
        folder = await db.get(Folder, current_id)
        if not folder:
            break
        path.insert(0, {"id": folder.id, "name": folder.name, "has_password": bool(folder.password_hash)})
        current_id = folder.parent_id
    
    return path


# ==================== 文件 API ====================

@router.get("/list")
async def list_files(
    folder_id: Optional[int] = Query(None, description="文件夹ID，为空表示根目录"),
    x_folder_password: Optional[str] = Header(default=None, alias="X-Folder-Password"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """获取文件列表"""
    if folder_id:
        folder = await db.get(Folder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        _require_folder_password(folder, x_folder_password)
        query = select(FileModel).where(FileModel.folder_id == folder_id)
    else:
        query = select(FileModel).where(FileModel.folder_id.is_(None))
    
    result = await db.execute(query.order_by(FileModel.created_at.desc()))
    files = result.scalars().all()
    
    return [{
        "id": f.id,
        "filename": f.filename,
        "object_name": f.object_name,
        "url": f.url,
        "size": f.size,
        "content_type": f.content_type,
        "folder_id": f.folder_id,
        "created_by": f.created_by,
        "created_at": f.created_at.isoformat() if f.created_at else None
    } for f in files]


@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    folder_id: Optional[int] = Query(None, description="上传到哪个文件夹"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """上传文件到指定文件夹"""
    results = []
    errors = []
    
    # 验证文件夹存在
    if folder_id:
        folder = await db.get(Folder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="目标文件夹不存在")
    
    for file in files:
        try:
            # 验证文件类型
            allowed_types = [
                "image/jpeg", "image/png", "image/gif", "image/webp", "image/jpg",
                "application/pdf", "text/plain", "text/csv",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "video/mp4",
            ]
            if file.content_type not in allowed_types:
                errors.append({"filename": file.filename, "error": f"不支持的文件类型: {file.content_type}"})
                continue
            
            # 验证文件大小 (最大 100MB)
            content = await file.read()
            if len(content) > 100 * 1024 * 1024:
                errors.append({"filename": file.filename, "error": "文件大小超过 100MB 限制"})
                continue
            
            # 上传到 MinIO
            upload_result = upload_file(
                file_data=content,
                filename=file.filename,
                content_type=file.content_type
            )
            
            # 保存到数据库
            file_record = FileModel(
                filename=file.filename,
                object_name=upload_result["object_name"],
                url=upload_result["url"],
                size=upload_result["size"],
                content_type=file.content_type,
                folder_id=folder_id,
                created_by=user.username
            )
            db.add(file_record)
            await db.commit()
            await db.refresh(file_record)
            
            results.append({
                "id": file_record.id,
                "filename": file_record.filename,
                "url": file_record.url,
                "size": file_record.size
            })
            
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})
    
    return {"success": results, "errors": errors, "total_uploaded": len(results), "total_failed": len(errors)}


@router.put("/{file_id}/move")
async def move_file(
    file_id: int,
    folder_id: Optional[int] = Query(None, description="目标文件夹ID，为空表示移到根目录"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """移动文件到指定文件夹"""
    file = await db.get(FileModel, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if folder_id:
        folder = await db.get(Folder, folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="目标文件夹不存在")
    
    file.folder_id = folder_id
    await db.commit()
    return {"message": "文件移动成功", "file_id": file_id, "new_folder_id": folder_id}


@router.post("/batch-move")
async def batch_move_files(
    payload: BatchMovePayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """批量移动文件到指定文件夹"""
    file_ids = list({int(fid) for fid in payload.file_ids})
    if not file_ids:
        raise HTTPException(status_code=400, detail="请选择要移动的文件")

    if payload.folder_id is not None:
        folder = await db.get(Folder, payload.folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail="目标文件夹不存在")

    await db.execute(
        update(FileModel)
        .where(FileModel.id.in_(file_ids))
        .values(folder_id=payload.folder_id)
    )
    await db.commit()
    return {"moved": len(file_ids), "folder_id": payload.folder_id}


@router.post("/batch-delete", status_code=204)
async def batch_delete_files(
    payload: BatchFileIdsPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """批量删除文件"""
    file_ids = list({int(fid) for fid in payload.file_ids})
    if not file_ids:
        raise HTTPException(status_code=400, detail="请选择要删除的文件")

    result = await db.execute(select(FileModel).where(FileModel.id.in_(file_ids)))
    files = result.scalars().all()
    operated_at = now_china()
    failed = []
    for f in files:
        db.add(
            AuditLog(
                table_name="file",
                record_id=f.id,
                operation="DELETE",
                diff_data={
                    "filename": f.filename,
                    "object_name": f.object_name,
                    "content_type": f.content_type,
                    "size": f.size,
                    "folder_id": f.folder_id,
                    "url": f.url,
                },
                operator=user.username,
                operated_at=operated_at,
                source="web",
            )
        )

        if not delete_file(f.object_name):
            failed.append(f.filename)

    if failed:
        preview = failed[:5]
        raise HTTPException(
            status_code=502,
            detail=f"部分文件删除失败，未清理数据库记录: {preview}" + ("..." if len(failed) > 5 else ""),
        )

    await db.execute(delete(FileModel).where(FileModel.id.in_(file_ids)))
    await db.commit()
    return None


@router.delete("/{file_id}")
async def delete_file_by_id(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """删除文件"""
    file = await db.get(FileModel, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")

    db.add(
        AuditLog(
            table_name="file",
            record_id=file.id,
            operation="DELETE",
            diff_data={
                "filename": file.filename,
                "object_name": file.object_name,
                "content_type": file.content_type,
                "size": file.size,
                "folder_id": file.folder_id,
                "url": file.url,
            },
            operator=user.username,
            operated_at=now_china(),
            source="web",
        )
    )

    # 从 MinIO 删除
    if not delete_file(file.object_name):
        raise HTTPException(status_code=502, detail="文件删除失败，请稍后重试")
    
    # 从数据库删除
    await db.delete(file)
    await db.commit()
    return {"message": "文件删除成功"}


# ==================== 下载 API ====================

@router.get("/{file_id}/download")
async def get_file_download_url(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """获取文件下载链接"""
    file = await db.get(FileModel, file_id)
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return {
        "url": file.url,
        "filename": file.filename,
        "content_type": file.content_type
    }


@router.post("/batch-download")
async def download_files_as_zip(
    payload: BatchFileIdsPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """批量下载文件为 ZIP 压缩包"""
    import zipfile
    import io
    import httpx
    from fastapi.responses import StreamingResponse

    file_ids = list({int(fid) for fid in payload.file_ids})
    if not file_ids:
        raise HTTPException(status_code=400, detail="请选择要下载的文件")

    files_result = await db.execute(select(FileModel).where(FileModel.id.in_(file_ids)))
    files = files_result.scalars().all()
    if not files:
        raise HTTPException(status_code=404, detail="未找到文件")

    zip_buffer = io.BytesIO()
    async with httpx.AsyncClient() as client:
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file in files:
                try:
                    response = await client.get(file.url)
                    if response.status_code == 200:
                        zip_file.writestr(file.filename, response.content)
                except Exception as e:
                    print(f"下载文件失败: {file.filename}, 错误: {e}")
                    continue

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="batch-files.zip"'}
    )


async def _download_folders_as_zip(
    db: AsyncSession,
    folder_ids: List[int],
    download_name: str
):
    import zipfile
    import io
    import httpx
    from fastapi.responses import StreamingResponse

    result = await db.execute(select(Folder))
    all_folders = result.scalars().all()
    folder_map = {folder.id: folder for folder in all_folders}
    missing_ids = [folder_id for folder_id in folder_ids if folder_id not in folder_map]
    if missing_ids:
        raise HTTPException(status_code=404, detail="文件夹不存在")

    children_map = _build_children_map(all_folders)
    descendant_ids = _collect_descendant_ids(folder_ids, children_map)
    files_result = await db.execute(select(FileModel).where(FileModel.folder_id.in_(descendant_ids)))
    files = files_result.scalars().all()
    if not files:
        raise HTTPException(status_code=400, detail="文件夹为空")

    root_folders = [folder_map[folder_id] for folder_id in folder_ids]
    name_counts = Counter([folder.name for folder in root_folders])
    root_name_map = {
        folder.id: f"{folder.name}_{folder.id}" if name_counts[folder.name] > 1 else folder.name
        for folder in root_folders
    }
    root_id_set = set(folder_ids)

    def build_folder_path(folder_id: Optional[int]) -> str:
        if not folder_id:
            return ""
        parts = []
        current_id = folder_id
        while current_id:
            folder = folder_map.get(current_id)
            if not folder:
                break
            if current_id in root_id_set:
                parts.append(root_name_map.get(current_id, folder.name))
                break
            parts.append(folder.name)
            current_id = folder.parent_id
        return "/".join(reversed(parts))

    zip_buffer = io.BytesIO()
    async with httpx.AsyncClient() as client:
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file in files:
                try:
                    response = await client.get(file.url)
                    if response.status_code == 200:
                        folder_path = build_folder_path(file.folder_id)
                        zip_path = f"{folder_path}/{file.filename}" if folder_path else file.filename
                        zip_file.writestr(zip_path, response.content)
                except Exception as e:
                    print(f"下载文件失败: {file.filename}, 错误: {e}")
                    continue

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'}
    )


@router.post("/folders/batch-download")
async def download_folders_as_zip(
    payload: BatchFolderIdsPayload,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """批量下载文件夹为 ZIP 压缩包"""
    folder_ids = list({int(fid) for fid in payload.folder_ids})
    if not folder_ids:
        raise HTTPException(status_code=400, detail="请选择要下载的文件夹")
    return await _download_folders_as_zip(db, folder_ids, "batch-folders.zip")


@router.get("/folders/{folder_id}/download")
async def download_folder_as_zip(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator"]))
):
    """下载文件夹为 ZIP 压缩包"""
    folder = await db.get(Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="文件夹不存在")
    return await _download_folders_as_zip(db, [folder_id], f"{folder.name}.zip")
