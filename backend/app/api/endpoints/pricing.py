from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import and_, func, or_, select, update

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import Approval, Channel, Price, PriceHistory
from app.schemas.common import ListResponse, Pagination
from app.schemas.price import ChannelCreate, ChannelRead, PriceCreate, PriceDecision, PriceRead

router = APIRouter()

EXPIRED_STATUSES = {"expired", "已失效"}


@router.get("/channels", response_model=ListResponse)
async def list_channels(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    status: Optional[str] = Query(default=None),
    parent_id: Optional[int] = Query(default=None),
):
    stmt = select(Channel)
    if status:
        stmt = stmt.where(Channel.status == status)
    if parent_id is not None:
        stmt = stmt.where(Channel.parent_id == parent_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(Channel.id).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[ChannelRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/channels", response_model=ChannelRead, status_code=status.HTTP_201_CREATED)
async def create_channel(payload: ChannelCreate, db: DbSession, _: User = Depends(get_current_user)):
    obj = Channel(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return ChannelRead.model_validate(obj)


async def _find_conflicts(db: DbSession, sku_id: int, channel_id: int, start_at, end_at, exclude_id: Optional[int] = None):
    stmt = select(Price).where(
        Price.sku_id == sku_id,
        Price.channel_id == channel_id,
        ~Price.status.in_(EXPIRED_STATUSES),
        or_(
            and_(Price.start_at <= start_at, Price.end_at >= start_at),
            and_(Price.start_at <= end_at, Price.end_at >= end_at),
            and_(Price.start_at >= start_at, Price.end_at <= end_at),
        ),
    )
    if exclude_id:
        stmt = stmt.where(Price.id != exclude_id)
    rows = await db.scalars(stmt)
    return list(rows)


@router.get("/prices", response_model=ListResponse)
async def list_prices(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
    sku_id: Optional[int] = Query(default=None),
    channel_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
):
    stmt = select(Price)
    if sku_id:
        stmt = stmt.where(Price.sku_id == sku_id)
    if channel_id:
        stmt = stmt.where(Price.channel_id == channel_id)
    if status:
        stmt = stmt.where(Price.status == status)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(Price.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[PriceRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/price-history", response_model=ListResponse)
async def list_price_history(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    price_id: Optional[int] = Query(default=None),
):
    stmt = select(PriceHistory)
    if price_id:
        stmt = stmt.where(PriceHistory.price_id == price_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(PriceHistory.operated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[row for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/prices", response_model=PriceRead, status_code=status.HTTP_201_CREATED)
async def create_price(
    payload: PriceCreate,
    db: DbSession,
    user: User = Depends(get_current_user),
    ):
    conflicts = await _find_conflicts(db, payload.sku_id, payload.channel_id, payload.start_at, payload.end_at)
    if conflicts:
        raise HTTPException(status_code=400, detail="时间区间与现有价格重叠")

    obj = Price(
        sku_id=payload.sku_id,
        channel_id=payload.channel_id,
        sale_price=Decimal(str(payload.sale_price)),
        cost_price=Decimal(str(payload.cost_price)) if payload.cost_price is not None else None,
        start_at=payload.start_at,
        end_at=payload.end_at,
        status=payload.status or "pending",
        created_by=payload.created_by or user.username,
    )
    db.add(obj)
    # Flush to obtain ID before creating the related approval record.
    await db.flush()
    approval_after_data = {
        "sku_id": obj.sku_id,
        "channel_id": obj.channel_id,
        "sale_price": str(obj.sale_price),
        "cost_price": str(obj.cost_price) if obj.cost_price is not None else None,
        "start_at": obj.start_at.isoformat(),
        "end_at": obj.end_at.isoformat(),
        "status": obj.status,
        "created_by": obj.created_by,
    }
    approval = Approval(
        object_type="price",
        object_id=obj.id,
        action_type="调价",
        before_data=None,
        after_data=approval_after_data,
        status="pending",
        applicant=user.username,
        approver="manager",
        applied_at=datetime.utcnow(),
    )
    db.add(approval)

    await db.commit()
    await db.refresh(obj)
    return PriceRead.model_validate(obj)


@router.post("/prices/{price_id}/decision", response_model=PriceRead)
async def decide_price(
    payload: PriceDecision,
    db: DbSession,
    price_id: int = Path(..., ge=1),
    user: User = Depends(require_roles(["manager"])),
):
    price = await db.get(Price, price_id)
    if not price:
        raise HTTPException(status_code=404, detail="价格不存在")

    if payload.approve:
        price.status = "active"
        # 旧生效版失效并截断时间
        active_prices = await db.scalars(
            select(Price).where(
                Price.sku_id == price.sku_id,
                Price.channel_id == price.channel_id,
                Price.id != price.id,
                Price.status == "active",
            )
        )
        for ap in active_prices:
            ap.status = "expired"
            ap.end_at = price.start_at - timedelta(days=1)
            db.add(
                PriceHistory(
                    price_id=ap.id,
                    before_data={"status": "active"},
                    after_data={"status": "expired", "end_at": ap.end_at.isoformat()},
                    operator=user.username,
                    operated_at=datetime.utcnow(),
                )
            )
        db.add(
            PriceHistory(
                price_id=price.id,
                before_data=None,
                after_data={"status": "active"},
                operator=user.username,
                operated_at=datetime.utcnow(),
            )
        )
    else:
        price.status = "rejected"

    # 更新相关审批记录
    await db.execute(
        update(Approval)
        .where(Approval.object_type == "price", Approval.object_id == price.id, Approval.status == "pending")
        .values(status="approved" if payload.approve else "rejected", decided_at=datetime.utcnow(), comment=payload.comment or "")
    )

    db.add(price)
    await db.commit()
    await db.refresh(price)
    return PriceRead.model_validate(price)
