from typing import Optional

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
):
    stmt = select(AuditLog)
    if table_name:
        stmt = stmt.where(AuditLog.table_name == table_name)
    if operator:
        stmt = stmt.where(AuditLog.operator == operator)
    if operation:
        stmt = stmt.where(AuditLog.operation == operation)
    if start_date:
        stmt = stmt.where(AuditLog.operated_at >= start_date)
    if end_date:
        # Assuming end_date logic needs to include the whole day if no time provided,
        # but if string comparison, '2023-01-01' < '2023-01-01 12:00:00' is False if using '>='.
        # Let's rely on string format matching or standard SQL behavior.
        # Ideally, cast to date or append time.
        # Simple string comparison works for ISO dates.
        # To include the end date day, we might need end_date + " 23:59:59"
        stmt = stmt.where(AuditLog.operated_at <= end_date + " 23:59:59")

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(AuditLog.operated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[AuditLogRead.model_validate(row) for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


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
            detail="Only super_admin can delete audit logs"
        )
    
    if not ids:
        return
    
    # 删除指定的日志
    for log_id in ids:
        log = await db.get(AuditLog, log_id)
        if log:
            await db.delete(log)
    
    await db.commit()
