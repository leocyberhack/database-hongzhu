from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import Product, Sku
from app.schemas.common import Pagination
from app.schemas.sku import SkuCreate, SkuListResponse, SkuResponse, SkuUpdate

router = APIRouter()


@router.post("", response_model=SkuResponse, status_code=201)
async def create_sku(
    payload: SkuCreate,
    db: DbSession,
    current_user: User = Depends(get_current_user),
):
    # Verify Product exists
    product = await db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {payload.product_id} not found")

    sku = Sku(**payload.model_dump())
    sku.created_by = current_user.username  # Record creator
    sku.poi_id = product.poi_id # Auto-inherit POI from product

    db.add(sku)
    try:
        await db.commit()
        await db.refresh(sku)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="SKU creation failed")
    
    return sku


@router.get("", response_model=SkuListResponse)
async def list_skus(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=500),
    product_id: Optional[int] = Query(default=None, description="Filter by product ID"),
    keyword: Optional[str] = Query(default=None, description="Search by sku name"),
    status: Optional[str] = Query(default=None, description="Filter by status")
):
    stmt = select(Sku)
    
    if product_id is not None:
        stmt = stmt.where(Sku.product_id == product_id)
    if keyword:
        stmt = stmt.where(Sku.sku_name.ilike(f"%{keyword}%"))
    if status:
        stmt = stmt.where(Sku.status == status)
    
    stmt = stmt.order_by(Sku.created_at.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))

    return SkuListResponse(
        items=[row for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/{sku_id}", response_model=SkuResponse)
async def get_sku(
    sku_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    sku = await db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    return sku


@router.patch("/{sku_id}", response_model=SkuResponse)
async def update_sku(
    sku_id: int,
    payload: SkuUpdate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    sku = await db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(sku, k, v)

    try:
        await db.commit()
        await db.refresh(sku)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Update failed")
    
    return sku


@router.delete("/{sku_id}", status_code=204)
async def delete_sku(
    sku_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    sku = await db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    # In a real system, you might want to check for dependencies (orders, price, inventory)
    # For now, we rely on DB foreign key constraints (ON DELETE RESTRICT is common for sensitive data)
    
    try:
        await db.delete(sku)
        await db.commit()
    except IntegrityError:
         await db.rollback()
         raise HTTPException(status_code=400, detail="Cannot delete SKU, it might be referenced by other records")
    
    return None
