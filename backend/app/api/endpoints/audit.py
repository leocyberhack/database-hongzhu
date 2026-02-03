from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import AuditLog
from app.schemas.audit import AuditLogRead
from app.schemas.common import ListResponse, Pagination

router = APIRouter()


@router.get("/audit-log", response_model=ListResponse)
async def list_audit_logs(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=1000),
    table_name: Optional[str] = Query(default=None),
    operator: Optional[str] = Query(default=None),
    operation: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),  # Format: YYYY-MM-DD
    end_date: Optional[str] = Query(default=None),    # Format: YYYY-MM-DD
    include_diff: bool = Query(default=True),
):
    stmt = select(AuditLog)
    if table_name:
        stmt = stmt.where(AuditLog.table_name == table_name)
    if operator:
        stmt = stmt.where(AuditLog.operator == operator)
    if operation:
        stmt = stmt.where(AuditLog.operation == operation)
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式错误，应为 YYYY-MM-DD")
        stmt = stmt.where(func.date(AuditLog.operated_at) >= start_dt)
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式错误，应为 YYYY-MM-DD")
        stmt = stmt.where(func.date(AuditLog.operated_at) <= end_dt)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(AuditLog.operated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    items = []
    for row in rows:
        payload = AuditLogRead.model_validate(row).model_dump()
        if not include_diff:
            payload["diff_data"] = None
        items.append(payload)
    return ListResponse(
        items=items,
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/audit-log/{log_id}", response_model=AuditLogRead)
async def get_audit_log(
    log_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    log = await db.get(AuditLog, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="审计日志不存在")
    return AuditLogRead.model_validate(log)


@router.post("/audit-log/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_audit_logs(
    ids: list[int],
    db: DbSession,
    user: User = Depends(get_current_user),
):
    """批量删除审计日志 - 仅限超级管理员"""
    # Only super_admin can delete logs
    if user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅超级管理员可删除审计日志"
        )
    
    if not ids:
        return
    
    # 删除指定的日志
    for log_id in ids:
        log = await db.get(AuditLog, log_id)
        if log:
            await db.delete(log)
    
    await db.commit()

