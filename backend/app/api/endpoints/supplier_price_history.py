from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import SupplierResourcePriceHistory
from app.schemas.common import ListResponse, Pagination

router = APIRouter()


@router.get("/supplier-resource-price-history", response_model=ListResponse)
async def list_supplier_resource_price_history(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=200, ge=1, le=500),
    supplier_resource_id: Optional[int] = Query(default=None),
):
    stmt = select(SupplierResourcePriceHistory)
    if supplier_resource_id:
        stmt = stmt.where(SupplierResourcePriceHistory.supplier_resource_id == supplier_resource_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(
        stmt.order_by(SupplierResourcePriceHistory.operated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    return ListResponse(
        items=[row for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )
