from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import AuditLog
from app.schemas.common import ListResponse, Pagination

router = APIRouter()


@router.get("/audit-log", response_model=ListResponse)
async def list_audit_logs(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    table_name: Optional[str] = Query(default=None),
    operator: Optional[str] = Query(default=None),
):
    stmt = select(AuditLog)
    if table_name:
        stmt = stmt.where(AuditLog.table_name == table_name)
    if operator:
        stmt = stmt.where(AuditLog.operator == operator)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(AuditLog.operated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[row for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )
