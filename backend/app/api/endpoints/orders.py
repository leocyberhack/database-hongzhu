from datetime import datetime
from app.utils.time import now_china
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import AuditLog, Inventory, InventoryLog, Order, OrderStatusHistory, Price, Sku, Product
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
        raise HTTPException(status_code=400, detail="Inventory not initialized")
    available = inv.total_qty - inv.frozen_qty - inv.sold_qty
    if available < qty:
        raise HTTPException(status_code=400, detail="Insufficient inventory to freeze")
    before = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    inv.frozen_qty += qty
    inv.updated_at = now_china()
    after = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    log = InventoryLog(
        sku_id=sku_id,
        inventory_date=travel_date,
        change_type="freeze",
        before_qty=before,
        after_qty=after,
        related_order_id=order_id,
        operator=operator,
        operated_at=now_china(),
    )
    db.add_all([inv, log])


async def _consume_inventory(db: DbSession, sku_id: int, travel_date, qty: int, operator: str, order_id: int, action: str):
    inv = await db.scalar(
        select(Inventory).where(Inventory.sku_id == sku_id, Inventory.inventory_date == travel_date).with_for_update()
    )
    if not inv:
        raise HTTPException(status_code=400, detail="Inventory not initialized")
    if inv.frozen_qty < qty:
        raise HTTPException(status_code=400, detail="Not enough frozen inventory to consume")
    before = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    inv.frozen_qty -= qty
    if action == "verify":
        inv.sold_qty += qty
    inv.updated_at = now_china()
    after = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    log = InventoryLog(
        sku_id=sku_id,
        inventory_date=travel_date,
        change_type="consume" if action == "verify" else "release",
        before_qty=before,
        after_qty=after,
        related_order_id=order_id,
        operator=operator,
        operated_at=now_china(),
    )
    db.add_all([inv, log])


@router.get("/orders", response_model=ListResponse)
async def list_orders(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
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
async def create_order(payload: OrderCreate, db: DbSession, user: User = Depends(require_roles(["admin", "operator", "csr"]))):
    dup = await db.scalar(
        select(Order).where(Order.order_no == payload.order_no, Order.channel_id == payload.channel_id)
    )
    if dup:
        raise HTTPException(status_code=400, detail="Duplicate order_no + channel")

    sku = await db.get(Sku, payload.sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")

    product = await db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if sku.product_id != payload.product_id:
        raise HTTPException(status_code=400, detail="SKU does not belong to product")
    
    # Calculate Dynamic Cost based on Resource Settlement Price
    # This replaces the static cost from Price table
    from app.models import ProductResource, ResourceInventory, SupplierResource
    
    # Get product resources
    pres = await db.scalars(select(ProductResource).where(ProductResource.product_id == payload.product_id))
    pres = list(pres)
    
    calculated_cost = Decimal("0.00")
    if pres:
        r_ids = [p.resource_id for p in pres]
        # Query inventory prices for these resources on the travel date
        # If product_resource specifies supplier, filter by it.
        # Otherwise, we might need a strategy. For MVP, we fetch all valid prices and pick relevant one.
        
        # We need to handle each resource line item
        for line in pres:
            qty_needed = line.quantity
            if qty_needed <= 0:
                continue
                
            # Query inventory and fallback price together
            q = select(ResourceInventory, SupplierResource.settlement_price).join(SupplierResource).where(
                SupplierResource.resource_id == line.resource_id,
                ResourceInventory.inventory_date == payload.travel_date
            )
            if line.supplier_id:
                q = q.where(SupplierResource.supplier_id == line.supplier_id)
            
            results = (await db.execute(q)).all()
            
            if not results:
                # No inventory record found. Fallback to SupplierResource default price
                sr_q = select(SupplierResource).where(SupplierResource.resource_id == line.resource_id)
                if line.supplier_id:
                    sr_q = sr_q.where(SupplierResource.supplier_id == line.supplier_id)
                srs = (await db.scalars(sr_q)).all()
                unit_cost = max([sr.settlement_price or 0 for sr in srs]) if srs else 0
            else:
                # Use the price from inventory record. If null, fallback to SR price
                valid_prices = []
                for inv, default_price in results:
                    price = inv.settlement_price if inv.settlement_price is not None else default_price
                    if price is not None:
                        valid_prices.append(price)
                
                if valid_prices:
                    unit_cost = max(valid_prices)
                else:
                    unit_cost = 0
            
            calculated_cost += Decimal(str(unit_cost)) * qty_needed

    active_price = await _active_price(db, payload.sku_id, payload.channel_id, payload.travel_date)
    sale_price = Decimal(str(payload.sale_price or (active_price.sale_price if active_price else 0)))
    
    # Use calculated dynamic cost if payload doesn't provide it
    cost_price = Decimal(str(payload.cost_price)) if payload.cost_price is not None else calculated_cost
    
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
        created_at=now_china(),
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
        operated_at=now_china(),
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
    user: User = Depends(require_roles(["admin", "operator", "csr"])),
):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if payload.action not in {"verify", "refund"}:
        raise HTTPException(status_code=400, detail="action must be one of verify or refund")

    if payload.action == "verify":
        if order.status != "paid":
            raise HTTPException(status_code=400, detail="Only paid orders can be verified")
        await _consume_inventory(db, order.sku_id, order.travel_date, order.quantity, user.username, order.id, "verify")
        order.status = "verified"
        order.verified_at = now_china()
    else:
        if order.status != "paid":
            raise HTTPException(status_code=400, detail="Only paid orders can be refunded")
        await _consume_inventory(db, order.sku_id, order.travel_date, order.quantity, user.username, order.id, "refund")
        order.status = "refunded"
        order.refunded_at = now_china()

    hist = OrderStatusHistory(
        order_id=order.id,
        before_status="paid",
        after_status=order.status,
        operator=user.username,
        operated_at=now_china(),
        reason=payload.comment,
    )
    audit = AuditLog(
        table_name="order",
        record_id=order.id,
        operation="STATUS_CHANGE",
        diff_data={"status": order.status},
        operator=user.username,
        operated_at=now_china(),
        source=payload.action,
    )
    db.add_all([order, hist, audit])
    await db.commit()
    await db.refresh(order)
    return OrderRead.model_validate(order)
