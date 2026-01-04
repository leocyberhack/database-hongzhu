from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import SkuChannel, Channel, Sku
from app.schemas.common import Pagination
from app.schemas.sku_channel import (
    SkuChannelCreate,
    SkuChannelListResponse,
    SkuChannelResponse,
    SkuChannelUpdate,
)

router = APIRouter()


@router.post("", response_model=SkuChannelResponse, status_code=201)
async def create_sku_channel(
    payload: SkuChannelCreate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    # Check if SKU and Channel exist
    sku = await db.get(Sku, payload.sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    channel = await db.get(Channel, payload.channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    sc = SkuChannel(**payload.model_dump())
    db.add(sc)
    try:
        await db.commit()
        await db.refresh(sc)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Binding already exists")
    
    # Reload to get related info logic if needed, but for now we manually attach if response model needs it
    # Or rely on lazy loading if async session allows (usually no in async unless eager load)
    # The Pydantic model has optional fields. Let's return the basic first.
    return sc


@router.get("", response_model=SkuChannelListResponse)
async def list_sku_channels(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=200, ge=1, le=500),
    sku_id: Optional[int] = Query(default=None),
    channel_id: Optional[int] = Query(default=None),
):
    # Eager load Channel and Sku to populate names
    stmt = (
        select(SkuChannel)
        .options(selectinload(SkuChannel.channel), selectinload(SkuChannel.sku))
    )
    
    if sku_id:
        stmt = stmt.where(SkuChannel.sku_id == sku_id)
    if channel_id:
        stmt = stmt.where(SkuChannel.channel_id == channel_id)
        
    stmt = stmt.order_by(SkuChannel.id.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))

    # Manually construct response items to inject names
    items = []
    for row in rows:
        item = SkuChannelResponse.model_validate(row)
        # Inject names if available (relationship loaded)
        if row.channel:
            item.channel_name = row.channel.channel_name
        if row.sku:
            item.sku_name = row.sku.sku_name
        items.append(item)

    return SkuChannelListResponse(
        items=items,
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/{id}", response_model=SkuChannelResponse)
async def get_sku_channel(
    id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    stmt = select(SkuChannel).where(SkuChannel.id == id).options(selectinload(SkuChannel.channel), selectinload(SkuChannel.sku))
    sc = await db.scalar(stmt)
    if not sc:
        raise HTTPException(status_code=404, detail="Binding not found")
    
    item = SkuChannelResponse.model_validate(sc)
    if sc.channel:
        item.channel_name = sc.channel.channel_name
    if sc.sku:
        item.sku_name = sc.sku.sku_name
    return item


@router.patch("/{id}", response_model=SkuChannelResponse)
async def update_sku_channel(
    id: int,
    payload: SkuChannelUpdate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    sc = await db.get(SkuChannel, id)
    if not sc:
        raise HTTPException(status_code=404, detail="Binding not found")

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(sc, k, v)

    try:
        await db.commit()
        await db.refresh(sc)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Update failed")
    
    return sc


@router.delete("/{id}", status_code=204)
async def delete_sku_channel(
    id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    sc = await db.get(SkuChannel, id)
    if not sc:
        raise HTTPException(status_code=404, detail="Binding not found")
    
    await db.delete(sc)
    await db.commit()
    return None
