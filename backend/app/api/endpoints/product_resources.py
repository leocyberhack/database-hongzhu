from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import ProductResource, ProductStructureSnapshot
from app.schemas.common import ListResponse, Pagination
from app.schemas.product import ProductResourceRead

router = APIRouter()


@router.get("/product-resources", response_model=ListResponse)
async def list_product_resources(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=200, ge=1, le=500),
    product_id: int | None = Query(default=None),
):
    stmt = select(ProductResource)
    if product_id:
        stmt = stmt.where(ProductResource.product_id == product_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[ProductResourceRead.model_validate(row) for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/product-snapshots", response_model=ListResponse)
async def list_product_snapshots(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=200, ge=1, le=500),
    product_id: int | None = Query(default=None),
):
    stmt = select(ProductStructureSnapshot)
    if product_id:
        stmt = stmt.where(ProductStructureSnapshot.product_id == product_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(ProductStructureSnapshot.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[row for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )
