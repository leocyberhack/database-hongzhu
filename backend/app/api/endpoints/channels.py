from datetime import datetime
from app.utils.time import now_china
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import AuditLog, Channel, Approval
from app.schemas.channel import ChannelCreate, ChannelListResponse, ChannelResponse, ChannelUpdate
from app.schemas.common import Pagination

router = APIRouter()


@router.post("", response_model=ChannelResponse, status_code=201)
async def create_channel(
    payload: ChannelCreate,
    db: DbSession,
    current_user: User = Depends(require_roles(["admin", "super_admin", "operator", "product"])),
):
    dup = await db.scalar(select(Channel).where(Channel.channel_name == payload.channel_name))
    if dup:
        raise HTTPException(status_code=400, detail="Channel name already exists")

    if current_user.role not in ["admin", "super_admin"]:
        # Create Channel Approval
        approval = Approval(
            object_type="channel",
            object_id=0, # No ID yet
            action_type="create",
            before_data=None,
            after_data=payload.model_dump(),
            status="pending",
            applicant=current_user.username,
            approver="admin",
            applied_at=now_china(),
        )
        db.add(approval)
        await db.commit()
        # Return a placeholder channel to satisfy schema
        return Channel(
            id=0,
            channel_name=payload.channel_name,
            channel_type=payload.channel_type,
            commission_rate=payload.commission_rate,
            created_at=now_china(),
            updated_at=now_china()  # Fixed: Added updated_at to match model
        )

    channel = Channel(**payload.model_dump())
    db.add(channel)
    try:
        await db.flush()
        
        # Record audit log
        audit = AuditLog(
            table_name="channel",
            record_id=channel.id,
            operation="CREATE",
            diff_data={"channel_name": channel.channel_name, "channel_type": channel.channel_type, "commission_rate": str(channel.commission_rate) if channel.commission_rate else None, "status": channel.status},
            operator=current_user.username,
            operated_at=now_china(),
            source="web",
        )
        db.add(audit)
        
        await db.commit()
        await db.refresh(channel)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Channel creation failed")
    
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
    user: User = Depends(require_roles(["admin", "super_admin", "operator", "product"])),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if payload.channel_name:
        dup = await db.scalar(select(Channel).where(Channel.channel_name == payload.channel_name, Channel.id != channel_id))
        if dup:
            raise HTTPException(status_code=400, detail="Channel name already exists")

    # Capture before state
    before_data = {"channel_name": channel.channel_name, "channel_type": channel.channel_type, "commission_rate": str(channel.commission_rate) if channel.commission_rate else None}
    
    update_data = payload.model_dump(exclude_unset=True)
    
    needs_approval = False
    if user.role not in ["admin", "super_admin"]:
        # Approval trigger: Rate change
        if "commission_rate" in update_data and update_data["commission_rate"] != channel.commission_rate:
            needs_approval = True
            
    if needs_approval:
        approval = Approval(
            object_type="channel",
            object_id=channel.id,
            action_type="update",
            before_data=before_data,
            after_data=update_data,
            status="pending",
            applicant=user.username,
            approver="admin",
            applied_at=now_china(),
        )
        db.add(approval)
        await db.commit()
        await db.refresh(approval)
        return channel

    for k, v in update_data.items():
        setattr(channel, k, v)

    try:
        # Record audit log
        audit = AuditLog(
            table_name="channel",
            record_id=channel.id,
            operation="UPDATE",
            diff_data={"before": before_data, "after": update_data},
            operator=user.username,
            operated_at=now_china(),
            source="web",
        )
        db.add(audit)
        
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
    user: User = Depends(require_roles(["admin", "super_admin", "operator", "product"])),
):
    channel = await db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if user.role not in ["admin", "super_admin"]:
        # Delete Channel Approval
        # Capture current state for restore/log
        before_data = {"channel_name": channel.channel_name, "channel_type": channel.channel_type}
        
        approval = Approval(
            object_type="channel",
            object_id=channel.id,
            action_type="delete",
            before_data=before_data,
            after_data=None,
            status="pending",
            applicant=user.username,
            approver="admin",
            applied_at=now_china(),
        )
        db.add(approval)
        await db.commit()
        return None
    
    # Check if there are sub-channels
    sub_count = await db.scalar(select(func.count()).where(Channel.parent_id == channel_id))
    if sub_count and sub_count > 0:
         raise HTTPException(status_code=400, detail="Cannot delete channel with sub-channels")

    # Record audit log before deletion
    audit = AuditLog(
        table_name="channel",
        record_id=channel.id,
        operation="DELETE",
        diff_data={"channel_name": channel.channel_name, "channel_type": channel.channel_type},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    await db.delete(channel)
    await db.commit()
    return None
# Hot reload test marker: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
