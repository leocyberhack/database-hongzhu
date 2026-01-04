from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import AuditLog, Inventory, InventoryLog, Order, OrderStatusHistory, Price, Sku
from app.schemas.common import ListResponse, Pagination
from app.schemas.order import OrderCreate, OrderDecision, OrderRead

router = APIRouter()


def _calc_amounts(sale_price: Decimal, cost_price: Decimal | None, qty: int):
    sale_amount = sale_price * qty
    cost_amount = cost_price * qty if cost_price is not None else None
    profit_amount = sale_amount - cost_amount if cost_amount is not None else None
    return sale_amount, cost_amount, profit_amount


async def _active_price(db: DbSession, sku_id: int, channel_id: int, travel_date):
    stmt = select(Price).where(
        Price.sku_id == sku_id,
        Price.channel_id == channel_id,
        Price.status == "active",
        Price.start_at <= travel_date,
        Price.end_at >= travel_date,
    )
    return await db.scalar(stmt)


async def _freeze_inventory(db: DbSession, sku_id: int, travel_date, qty: int, operator: str, order_id: Optional[int]):
    inv = await db.scalar(
        select(Inventory).where(Inventory.sku_id == sku_id, Inventory.inventory_date == travel_date).with_for_update()
    )
    if not inv:
        raise HTTPException(status_code=400, detail="库存未初始化")
    available = inv.total_qty - inv.frozen_qty - inv.sold_qty
    if available < qty:
        raise HTTPException(status_code=400, detail="库存不足，无法冻结")
    before = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    inv.frozen_qty += qty
    inv.updated_at = datetime.utcnow()
    after = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    log = InventoryLog(
        sku_id=sku_id,
        inventory_date=travel_date,
        change_type="freeze",
        before_qty=before,
        after_qty=after,
        related_order_id=order_id,
        operator=operator,
        operated_at=datetime.utcnow(),
    )
    db.add_all([inv, log])


async def _consume_inventory(db: DbSession, sku_id: int, travel_date, qty: int, operator: str, order_id: int, action: str):
    inv = await db.scalar(
        select(Inventory).where(Inventory.sku_id == sku_id, Inventory.inventory_date == travel_date).with_for_update()
    )
    if not inv:
        raise HTTPException(status_code=400, detail="库存未初始化")
    if inv.frozen_qty < qty:
        raise HTTPException(status_code=400, detail="冻结库存不足")
    before = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    inv.frozen_qty -= qty
    if action == "verify":
        inv.sold_qty += qty
    inv.updated_at = datetime.utcnow()
    after = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    log = InventoryLog(
        sku_id=sku_id,
        inventory_date=travel_date,
        change_type="consume" if action == "verify" else "release",
        before_qty=before,
        after_qty=after,
        related_order_id=order_id,
        operator=operator,
        operated_at=datetime.utcnow(),
    )
    db.add_all([inv, log])


@router.get("/orders", response_model=ListResponse)
async def list_orders(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    status: Optional[str] = Query(default=None),
    sku_id: Optional[int] = Query(default=None),
    channel_id: Optional[int] = Query(default=None),
):
    stmt = select(Order)
    if status:
        stmt = stmt.where(Order.status == status)
    if sku_id:
        stmt = stmt.where(Order.sku_id == sku_id)
    if channel_id:
        stmt = stmt.where(Order.channel_id == channel_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(Order.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[OrderRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(payload: OrderCreate, db: DbSession, user: User = Depends(get_current_user)):
    dup = await db.scalar(
        select(Order).where(Order.order_no == payload.order_no, Order.channel_id == payload.channel_id)
    )
    if dup:
        raise HTTPException(status_code=400, detail="重复的订单号+渠道")

    sku = await db.get(Sku, payload.sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU 不存在")
    active_price = await _active_price(db, payload.sku_id, payload.channel_id, payload.travel_date)
    sale_price = Decimal(str(payload.sale_price or (active_price.sale_price if active_price else 0)))
    cost_price = Decimal(str(payload.cost_price)) if payload.cost_price is not None else (
        Decimal(str(active_price.cost_price)) if active_price and active_price.cost_price is not None else None
    )
    sale_amount, cost_amount, profit_amount = _calc_amounts(sale_price, cost_price, payload.quantity)

    order = Order(
        order_no=payload.order_no,
        channel_id=payload.channel_id,
        sku_id=payload.sku_id,
        product_id=payload.product_id,
        travel_date=payload.travel_date,
        quantity=payload.quantity,
        sale_price=sale_price,
        sale_amount=sale_amount,
        cost_price=cost_price,
        cost_amount=cost_amount,
        profit_amount=profit_amount,
        status="paid",
        created_by=user.username,
        created_at=datetime.utcnow(),
        remark=payload.remark,
    )
    db.add(order)
    await db.flush()

    # freeze inventory
    await _freeze_inventory(db, payload.sku_id, payload.travel_date, payload.quantity, user.username, order.id)

    hist = OrderStatusHistory(
        order_id=order.id,
        before_status=None,
        after_status="paid",
        operator=user.username,
        operated_at=datetime.utcnow(),
    )
    db.add(hist)
    await db.commit()
    await db.refresh(order)
    return OrderRead.model_validate(order)


@router.post("/orders/{order_id}/decision", response_model=OrderRead)
async def decide_order(
    payload: OrderDecision,
    db: DbSession,
    order_id: int = Path(..., ge=1),
    user: User = Depends(require_roles(["manager", "operator", "csr"])),
):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if payload.action not in {"verify", "refund"}:
        raise HTTPException(status_code=400, detail="action 必须是 verify 或 refund")

    if payload.action == "verify":
        if order.status != "paid":
            raise HTTPException(status_code=400, detail="仅已支付订单可核销")
        await _consume_inventory(db, order.sku_id, order.travel_date, order.quantity, user.username, order.id, "verify")
        order.status = "verified"
        order.verified_at = datetime.utcnow()
    else:
        if order.status != "paid":
            raise HTTPException(status_code=400, detail="仅已支付订单可退款")
        await _consume_inventory(db, order.sku_id, order.travel_date, order.quantity, user.username, order.id, "refund")
        order.status = "refunded"
        order.refunded_at = datetime.utcnow()

    hist = OrderStatusHistory(
        order_id=order.id,
        before_status="paid",
        after_status=order.status,
        operator=user.username,
        operated_at=datetime.utcnow(),
        reason=payload.comment,
    )
    audit = AuditLog(
        table_name="order",
        record_id=order.id,
        operation="STATUS_CHANGE",
        diff_data={"status": order.status},
        operator=user.username,
        operated_at=datetime.utcnow(),
        source=payload.action,
    )
    db.add_all([order, hist, audit])
    await db.commit()
    await db.refresh(order)
    return OrderRead.model_validate(order)
