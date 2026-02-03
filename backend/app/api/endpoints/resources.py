from datetime import datetime
from app.utils.time import now_china
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.api.endpoints.files import _delete_folders_with_files
from app.models import AuditLog, Poi, Resource, ProductResource
from app.schemas.common import (
    ListResponse,
    Pagination,
    PoiCreate,
    PoiRead,
    PoiUpdate,
    ResourceCreate,
    ResourceRead,
    ResourceUpdate,
)

router = APIRouter()


@router.get("/poi", response_model=ListResponse)
async def list_poi(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    keyword: Optional[str] = Query(default=None),
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
):
    stmt = select(Poi)
    if keyword:
        stmt = stmt.where(Poi.poi_name.ilike(f"%{keyword}%"))
    
    # Sorting logic
    if sort_field and hasattr(Poi, sort_field):
        field = getattr(Poi, sort_field)
        if sort_order == "descend":
            stmt = stmt.order_by(field.desc())
        else:
            stmt = stmt.order_by(field.asc())
    else:
        # Default: Aggregate by city (Cluster by city)
        # Use city asc, then id desc
        stmt = stmt.order_by(Poi.city.asc(), Poi.id.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[PoiRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


# ... (create, update, delete omitted, keeping file intact) ...


@router.get("/resources", response_model=ListResponse)
async def list_resources(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    ids: Optional[list[int]] = Query(default=None),
    poi_id: Optional[int] = Query(default=None),
    resource_type: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
):
    stmt = select(Resource)
    if ids:
        stmt = stmt.where(Resource.id.in_(ids))
    if poi_id:
        stmt = stmt.where(Resource.poi_id == poi_id)
    if resource_type:
        stmt = stmt.where(Resource.resource_type == resource_type)
    if keyword:
        stmt = stmt.where(Resource.resource_name.ilike(f"%{keyword}%"))
        
    # Sorting logic
    if sort_field and hasattr(Resource, sort_field):
        field = getattr(Resource, sort_field)
        if sort_order == "descend":
            stmt = stmt.order_by(field.desc())
        else:
            stmt = stmt.order_by(field.asc())
    else:
        # Default: Aggregate by POI
        stmt = stmt.order_by(Resource.poi_id.asc(), Resource.id.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[ResourceRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/poi", response_model=PoiRead, status_code=status.HTTP_201_CREATED)
async def create_poi(
    payload: PoiCreate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    from app.models import Folder
    
    # poi_type必填校验
    if not payload.poi_type:
        raise HTTPException(status_code=400, detail="POI 类型不能为空")
    
    # poi_type枚举值校验
    valid_types = ["景区", "酒店", "餐饮", "交通"]
    if payload.poi_type not in valid_types:
        raise HTTPException(
            status_code=400, 
            detail=f"无效的 POI 类型，必须是: {', '.join(valid_types)}"
        )
    
    # Unique check by name（全局不重复，编辑未改名允许）
    exists = await db.scalar(select(Poi).where(Poi.poi_name == payload.poi_name))
    if exists:
        raise HTTPException(status_code=400, detail="POI 名称已存在")
    
    # 1. 为新POI创建独立的根级文件夹（parent_id = NULL）
    # 文件夹名称格式：POI_{poi_name}
    poi_folder = Folder(
        name=f"POI_{payload.poi_name}",
        parent_id=None,  # 根级文件夹，完全独立
        created_by=user.username,
    )
    db.add(poi_folder)
    await db.flush()
    
    # 2. 创建POI并关联文件夹
    poi_data = payload.model_dump()
    poi_data['folder_id'] = poi_folder.id
    obj = Poi(**poi_data)
    db.add(obj)
    await db.flush()
    
    # Record audit log with poi_type and attrs
    audit_data = {
        "poi_name": obj.poi_name, 
        "poi_type": obj.poi_type,
        "poi_code": obj.poi_code,
        "province": obj.province,
        "city": obj.city,
        "district": obj.district,
        "folder_id": obj.folder_id,
    }
    if obj.longitude is not None:
        audit_data["longitude"] = obj.longitude
    if obj.latitude is not None:
        audit_data["latitude"] = obj.latitude
    if obj.address:
        audit_data["address"] = obj.address
    if obj.attrs:
        audit_data["attrs"] = obj.attrs
    
    audit = AuditLog(
        table_name="poi",
        record_id=obj.id,
        operation="CREATE",
        diff_data=audit_data,
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(obj)
    return PoiRead.model_validate(obj)




@router.put("/poi/{poi_id}", response_model=PoiRead)
async def update_poi(
    poi_id: int,
    payload: PoiUpdate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    poi = await db.get(Poi, poi_id)
    if not poi:
        raise HTTPException(status_code=404, detail="POI 不存在")

    # Name uniqueness：同名其他记录不允许
    if payload.poi_name:
        dup = await db.scalar(select(Poi).where(Poi.poi_name == payload.poi_name, Poi.id != poi_id))
        if dup:
            raise HTTPException(status_code=400, detail="POI 名称已存在")
    
    # poi_type变更校验：如果要修改poi_type，需要检查是否有关联资源
    if payload.poi_type and payload.poi_type != poi.poi_type:
        # 检查该POI下是否有资源
        resource_count = await db.scalar(
            select(func.count()).select_from(Resource).where(Resource.poi_id == poi_id)
        )
        if resource_count and resource_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"无法修改POI类型：该POI下已有 {resource_count} 个资源，修改类型会导致资源类型不一致"
            )
        
        # poi_type枚举值校验
        valid_types = ["景区", "酒店", "餐饮", "交通"]
        if payload.poi_type not in valid_types:
            raise HTTPException(
                status_code=400, 
                detail=f"无效的 POI 类型，必须是: {', '.join(valid_types)}"
            )
    
    # Capture before state (include poi_type and attrs)
    before_data = {
        "poi_name": poi.poi_name, 
        "poi_type": poi.poi_type,
        "poi_code": poi.poi_code,
        "province": poi.province,
        "city": poi.city,
        "district": poi.district,
        "status": poi.status
    }
    if poi.longitude is not None:
        before_data["longitude"] = poi.longitude
    if poi.latitude is not None:
        before_data["latitude"] = poi.latitude
    if poi.address:
        before_data["address"] = poi.address
    if poi.attrs:
        before_data["attrs"] = poi.attrs
    
    # Update only provided fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(poi, field, value)
    
    # Capture after state (include poi_type and attrs)
    after_data = {
        "poi_name": poi.poi_name,
        "poi_type": poi.poi_type,
        "poi_code": poi.poi_code,
        "province": poi.province,
        "city": poi.city,
        "district": poi.district,
        "status": poi.status
    }
    if poi.longitude is not None:
        after_data["longitude"] = poi.longitude
    if poi.latitude is not None:
        after_data["latitude"] = poi.latitude
    if poi.address:
        after_data["address"] = poi.address
    if poi.attrs:
        after_data["attrs"] = poi.attrs
    
    # Record audit log
    audit = AuditLog(
        table_name="poi",
        record_id=poi.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": after_data},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(poi)
    return PoiRead.model_validate(poi)



@router.delete("/poi/{poi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poi(
    poi_id: int,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    poi = await db.get(Poi, poi_id)
    if not poi:
        raise HTTPException(status_code=404, detail="POI 不存在")

    # Block deletion if POI still has resources
    resource_count = await db.scalar(
        select(func.count()).select_from(Resource).where(Resource.poi_id == poi_id)
    )
    if resource_count and resource_count > 0:
        raise HTTPException(status_code=400, detail=f"无法删除POI：已关联 {resource_count} 个资源")
    
    # Record audit log before deletion
    audit = AuditLog(
        table_name="poi",
        record_id=poi.id,
        operation="DELETE",
        diff_data={
            "poi_name": poi.poi_name,
            "poi_code": poi.poi_code,
            "province": poi.province,
            "city": poi.city,
            "district": poi.district,
            "address": poi.address,
            "longitude": poi.longitude,
            "latitude": poi.latitude,
        },
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    if poi.folder_id:
        await _delete_folders_with_files(db, [poi.folder_id], user.username)

    await db.delete(poi)
    await db.commit()
    return None


@router.post("/poi/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_poi(
    poi_ids: list[int],
    db: DbSession,
    user: User = Depends(get_current_user),
):
    if not poi_ids:
        return None

    # Block deletion if any POI still has resources
    usage_rows = await db.execute(
        select(Resource.poi_id, func.count())
        .where(Resource.poi_id.in_(poi_ids))
        .group_by(Resource.poi_id)
    )
    usage_map = {pid: cnt for pid, cnt in usage_rows.all()}
    if usage_map:
        blocked = sorted(usage_map.keys())
        preview = ", ".join(str(i) for i in blocked[:10])
        suffix = f" 等 {len(blocked)} 个 POI" if len(blocked) > 10 else ""
        raise HTTPException(status_code=400, detail=f"以下 POI 存在资源，无法删除: {preview}{suffix}")

    pois = []
    folder_ids: set[int] = set()
    for poi_id in poi_ids:
        poi = await db.get(Poi, poi_id)
        if poi:
            pois.append(poi)
            if poi.folder_id:
                folder_ids.add(poi.folder_id)

    if folder_ids:
        await _delete_folders_with_files(db, list(folder_ids), user.username)

    for poi in pois:
        await db.delete(poi)
    await db.commit()
    return None

@router.post("/poi/batch-update")
async def batch_update_poi(
    updates: dict,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    """
    Batch update POIs. Expects payload like:
    {
        "ids": [1, 2, 3],
        "fields": {"city": "鍖椾含"}
    }
    """
    poi_ids = updates.get("ids", [])
    fields = updates.get("fields", {})
    if not poi_ids or not fields:
        return {"updated": 0, "pending": 0, "skipped": 0, "errors": []}

    poi_ids = list(dict.fromkeys(poi_ids))
    pois = list(await db.scalars(select(Poi).where(Poi.id.in_(poi_ids))))
    if len(pois) != len(poi_ids):
        found_ids = {p.id for p in pois}
        missing = [pid for pid in poi_ids if pid not in found_ids]
        raise HTTPException(status_code=404, detail=f"POI 不存在: {missing}")

    if "poi_name" in fields:
        if len(poi_ids) > 1:
            raise HTTPException(status_code=400, detail="批量更新不支持同时修改多个POI名称")
        dup = await db.scalar(select(Poi).where(Poi.poi_name == fields["poi_name"], Poi.id != poi_ids[0]))
        if dup:
            raise HTTPException(status_code=400, detail="POI 名称已存在")

    if "poi_type" in fields:
        valid_types = ["景区", "酒店", "餐饮", "交通"]
        if fields["poi_type"] not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"无效的 POI 类型，必须是: {', '.join(valid_types)}",
            )
        # Prevent changing type if POI has resources
        resource_counts = await db.execute(
            select(Resource.poi_id, func.count()).where(Resource.poi_id.in_(poi_ids)).group_by(Resource.poi_id)
        )
        resource_map = {pid: cnt for pid, cnt in resource_counts.all()}
        blocked = []
        for poi_id in poi_ids:
            poi = await db.get(Poi, poi_id)
            if not poi:
                continue
            if poi.poi_type != fields["poi_type"] and resource_map.get(poi_id, 0) > 0:
                blocked.append(poi_id)
        if blocked:
            raise HTTPException(
                status_code=400,
                detail=f"无法修改POI类型：以下POI已有资源 {blocked}",
            )
    
    updated_count = 0
    for poi in pois:
        for field, value in fields.items():
            if hasattr(poi, field):
                setattr(poi, field, value)
        updated_count += 1
    
    await db.commit()
    return {"updated": updated_count, "pending": 0, "skipped": 0, "errors": []}





@router.post("/resources", response_model=ResourceRead, status_code=status.HTTP_201_CREATED)
async def create_resource(
    payload: ResourceCreate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    # 资源名称全局唯一（编辑未改名允许）
    dup = await db.scalar(select(Resource).where(Resource.resource_name == payload.resource_name))
    if dup:
        raise HTTPException(status_code=400, detail="资源名称已存在")
    
    # 获取POI信息，自动继承poi_type作为resource_type
    poi = await db.get(Poi, payload.poi_id)
    if not poi:
        raise HTTPException(status_code=404, detail="POI 不存在")
    
    # 强制：resource_type必须与POI的poi_type一致
    # 如果payload中提供了resource_type，检查是否一致
    if payload.resource_type and payload.resource_type != poi.poi_type:
        raise HTTPException(
            status_code=400, 
            detail=f"资源类型必须与POI类型一致。该POI类型为: {poi.poi_type}"
        )
    
    # 自动设置resource_type为POI的poi_type
    payload_dict = payload.model_dump()
    payload_dict['resource_type'] = poi.poi_type

    obj = Resource(**payload_dict)
    db.add(obj)
    await db.flush()
    
    # Record audit log with complete resource data including attrs
    audit_data = {
        "resource_name": obj.resource_name,
        "resource_code": obj.resource_code,
        "resource_type": obj.resource_type,
        "poi_id": obj.poi_id,
        "status": obj.status
    }
    # Include attrs if present (景区/酒店特定字段)
    if obj.attrs:
        audit_data["attrs"] = obj.attrs
    
    audit = AuditLog(
        table_name="resource",
        record_id=obj.id,
        operation="CREATE",
        diff_data=audit_data,
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(obj)
    return ResourceRead.model_validate(obj)


@router.put("/resources/{resource_id}", response_model=ResourceRead)
async def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")

    if payload.resource_name:
        dup = await db.scalar(select(Resource).where(Resource.resource_name == payload.resource_name, Resource.id != resource_id))
        if dup:
            raise HTTPException(status_code=400, detail="资源名称已存在")

    if payload.poi_id and payload.poi_id != resource.poi_id:
        new_poi = await db.get(Poi, payload.poi_id)
        if not new_poi:
            raise HTTPException(status_code=404, detail="POI 不存在")
        if new_poi.poi_type != resource.resource_type:
            raise HTTPException(status_code=400, detail="资源类型必须与POI类型一致")
    
    # 禁止修改resource_type（因为它继承自POI的poi_type）
    if payload.resource_type:
        raise HTTPException(
            status_code=400, 
            detail="无法修改资源类型。资源类型继承自POI，如需修改请修改对应的POI类型"
        )
    
    # Capture before state with all important fields including attrs
    before_data = {
        "resource_name": resource.resource_name,
        "resource_code": resource.resource_code,
        "resource_type": resource.resource_type,
        "status": resource.status,
        "poi_id": resource.poi_id
    }
    if resource.attrs:
        before_data["attrs"] = resource.attrs
    
    # Validations
    update_data = payload.model_dump(exclude_unset=True)
    
    # Logic Lock 1: Active resources used by products cannot be deactivated
    if "status" in update_data and update_data["status"] != resource.status:
        if resource.status == "active" and update_data["status"] != "active": # Assuming target is inactive/draft
             # Check usage
             from app.models import ProductResource
             usage_count = await db.scalar(select(func.count()).where(ProductResource.resource_id == resource_id))
             if usage_count and usage_count > 0:
                 raise HTTPException(status_code=400, detail="资源已被产品使用，无法下架")

    for field, value in update_data.items():
        setattr(resource, field, value)
    
    # Record audit log with complete before/after data
    audit = AuditLog(
        table_name="resource",
        record_id=resource.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": update_data},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(resource)
    return ResourceRead.model_validate(resource)


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: int,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    from app.models import ProductResource, SupplierResource
    
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在")
    
    # Only check if resource is referenced by products (ProductResource)
    product_resource_count = await db.scalar(
        select(func.count()).select_from(ProductResource).where(ProductResource.resource_id == resource_id)
    )
    if product_resource_count and product_resource_count > 0:
        raise HTTPException(status_code=400, detail=f"无法删除资源：已被 {product_resource_count} 个产品引用，请先移除产品-资源关联")
    
    # Record audit log before deletion
    audit = AuditLog(
        table_name="resource",
        record_id=resource.id,
        operation="DELETE",
        diff_data={
            "resource_name": resource.resource_name,
            "resource_code": resource.resource_code,
            "resource_type": resource.resource_type,
        },
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    # Delete related SupplierResource records first (supplier-resource associations)
    # Note: ResourceInventory records are automatically cascade-deleted via SupplierResource FK
    from sqlalchemy import delete
    await db.execute(delete(SupplierResource).where(SupplierResource.resource_id == resource_id))
    
    await db.delete(resource)
    await db.commit()
    return None


@router.post("/resources/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_resources(
    resource_ids: list[int],
    db: DbSession,
    user: User = Depends(get_current_user),
):
    from app.models import ProductResource, SupplierResource
    
    deleted_count = 0
    for resource_id in resource_ids:
        resource = await db.get(Resource, resource_id)
        if not resource:
            continue
        
        # 检查是否被产品引用
        product_usage = await db.scalar(
            select(func.count()).select_from(ProductResource)
            .where(ProductResource.resource_id == resource_id)
        )
        if product_usage and product_usage > 0:
            # 跳过被引用的资源
            continue
        
        # 先删除关联的SupplierResource记录
        await db.execute(
            delete(SupplierResource).where(SupplierResource.resource_id == resource_id)
        )
        
        # 再删除Resource (ResourceInventory会通过CASCADE自动删除)
        await db.delete(resource)
        deleted_count += 1
    
    await db.commit()
    return None


@router.post("/resources/batch-update")
async def batch_update_resources(
    updates: dict,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    """
    Batch update resources. Expects payload like:
    {
        "ids": [1, 2, 3],
        "fields": {"status": "inactive"}
    }
    """
    resource_ids = updates.get("ids", [])
    fields = updates.get("fields", {})
    if not resource_ids or not fields:
        return {"updated": 0, "pending": 0, "skipped": 0, "errors": []}

    resource_ids = list(dict.fromkeys(resource_ids))
    resources = list(await db.scalars(select(Resource).where(Resource.id.in_(resource_ids))))
    if len(resources) != len(resource_ids):
        found_ids = {r.id for r in resources}
        missing = [rid for rid in resource_ids if rid not in found_ids]
        raise HTTPException(status_code=404, detail=f"资源不存在: {missing}")

    if "resource_type" in fields:
        raise HTTPException(status_code=400, detail="批量更新不允许修改资源类型")

    if "resource_name" in fields:
        if len(resource_ids) > 1:
            raise HTTPException(status_code=400, detail="批量更新不支持同时修改多个资源名称")
        dup = await db.scalar(
            select(Resource).where(Resource.resource_name == fields["resource_name"], Resource.id != resource_ids[0])
        )
        if dup:
            raise HTTPException(status_code=400, detail="资源名称已存在")

    new_poi = None
    if "poi_id" in fields:
        new_poi = await db.get(Poi, fields["poi_id"])
        if not new_poi:
            raise HTTPException(status_code=404, detail="POI 不存在")

    # Preload usage counts
    usage_counts = await db.execute(
        select(ProductResource.resource_id, func.count())
        .where(ProductResource.resource_id.in_(resource_ids))
        .group_by(ProductResource.resource_id)
    )
    usage_map = {rid: cnt for rid, cnt in usage_counts.all()}

    if "status" in fields:
        new_status = fields["status"]
        blocked = []
        for resource in resources:
            if resource.status == "active" and new_status != "active":
                if usage_map.get(resource.id, 0) > 0:
                    blocked.append(resource.id)
        if blocked:
            raise HTTPException(
                status_code=400,
                detail=f"以下资源已被产品使用，无法下架: {blocked}",
            )

    if new_poi is not None:
        for resource in resources:
            if new_poi.poi_type != resource.resource_type:
                raise HTTPException(status_code=400, detail="资源类型必须与POI类型一致")
    
    updated_count = 0
    for resource in resources:
        for field, value in fields.items():
            if hasattr(resource, field):
                setattr(resource, field, value)
        updated_count += 1
    
    await db.commit()
    return {"updated": updated_count, "pending": 0, "skipped": 0, "errors": []}



