from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import Channel
from app.schemas.channel import ChannelCreate, ChannelListResponse, ChannelResponse, ChannelUpdate
from app.schemas.common import Pagination

router = APIRouter()


@router.post("", response_model=ChannelResponse, status_code=201)
async def create_channel(
    payload: ChannelCreate,
    db: DbSession,
    current_user: User = Depends(get_current_user),
):
    channel = Channel(**payload.model_dump())
    db.add(channel)
    try:
        await db.commit()
        await db.refresh(channel)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Channel creation failed, name might be duplicated")
    
    return channel


@router.get("", response_model=ChannelListResponse)
async def list_channels(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    parent_id: Optional[int] = Query(default=None, description="Search keyword"),
    keyword: Optional[str] = Query(default=None, description="Search keyword"),
    status: Optional[str] = Query(default=None, description="Filter by status")
):
    stmt = select(Channel)
    
    if parent_id is not None:
        stmt = stmt.where(Channel.parent_id == parent_id)
    if keyword:
        stmt = stmt.where(Channel.channel_name.ilike(f"%{keyword}%"))
    if status is not None:
         stmt = stmt.where(Channel.status == status)
    
    # Order by creation time desc
    stmt = stmt.order_by(Channel.created_at.desc())

    # Count total
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))

    # Paging
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    
    return ChannelListResponse(
        items=[row for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel(
    channel_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channel


@router.patch("/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: int,
    payload: ChannelUpdate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(channel, k, v)

    try:
        await db.commit()
        await db.refresh(channel)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Update failed")
    
    return channel


@router.delete("/{channel_id}", status_code=204)
async def delete_channel(
    channel_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if there are sub-channels
    sub_count = await db.scalar(select(func.count()).where(Channel.parent_id == channel_id))
    if sub_count and sub_count > 0:
         raise HTTPException(status_code=400, detail="Cannot delete channel with sub-channels")

    await db.delete(channel)
    await db.commit()
    return None
# Hot reload test marker: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
