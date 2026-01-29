from datetime import datetime
from app.utils.time import now_china
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import AuditLog, Inventory, InventoryLog, Order, OrderResource, OrderStatusHistory, Price, Sku, Product
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
    # 1. Check duplicate
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
    
    # 2. Process Product Resources & Choose Suppliers
    from app.models import ProductResource, ResourceInventory, SupplierResource
    
    # Get product resources
    pres = await db.scalars(select(ProductResource).where(ProductResource.product_id == payload.product_id))
    pres = list(pres)
    
    calculated_cost = Decimal("0.00")
    order_resources_data = [] # List of dicts to create OrderResource
    
    # Manual selection map: resource_id -> supplier_id
    selections = payload.resource_selections or {}

    for line in pres:
        qty_needed = line.quantity * payload.quantity
        if qty_needed <= 0:
            continue
            
        # Determine candidate suppliers
        candidates = []
        if line.supplier_mode == 'locked':
            if not line.supplier_ids:
                raise HTTPException(status_code=400, detail=f"Booked resource {line.resource_id} is locked but has no suppliers")
            # Fetch SupplierResources for these IDs
            stmt = select(SupplierResource).where(
                SupplierResource.resource_id == line.resource_id,
                SupplierResource.supplier_id.in_(line.supplier_ids)
            )
            # candidates = list(await db.scalars(stmt))
            candidates = (await db.scalars(stmt)).all()
        else: # 'auto'
            # Fetch ALL SupplierResources for this resource
            stmt = select(SupplierResource).where(SupplierResource.resource_id == line.resource_id)
            # candidates = list(await db.scalars(stmt))
            candidates = (await db.scalars(stmt)).all()
            
        if not candidates:
            raise HTTPException(status_code=400, detail=f"No suppliers found for resource {line.resource_id}")

        # Fetch effective prices for candidates on travel_date
        # We also need to check stock availability here or later. For now, we prefer those with stock.
        candidate_prices = [] # (supplier_id, price, has_stock, supplier_resource_id)
        
        for cand in candidates:
            # Check ResourceInventory
            inv = await db.scalar(
                select(ResourceInventory).where(
                    ResourceInventory.supplier_resource_id == cand.id,
                    ResourceInventory.inventory_date == payload.travel_date
                )
            )
            
            # Determine price
            price = cand.settlement_price
            if inv and inv.settlement_price is not None:
                price = inv.settlement_price
            
            # Determine stock
            # available = total - frozen - sold
            has_stock = False
            if inv:
                avail = inv.total_qty - inv.frozen_qty - inv.sold_qty
                if avail >= qty_needed:
                    has_stock = True
            
            candidate_prices.append({
                "supplier_id": cand.supplier_id,
                "price": price or Decimal(0),
                "has_stock": has_stock,
                "supplier_resource_id": cand.id,
                "cand_obj": cand
            })

        # Filter: If manual selection exists, force it
        selected_cand = None
        if line.resource_id in selections:
            target_sid = selections[line.resource_id]
            # Find in candidates
            found = [c for c in candidate_prices if c["supplier_id"] == target_sid]
            if not found:
                 raise HTTPException(status_code=400, detail=f"Selected supplier {target_sid} is not valid for resource {line.resource_id}")
            selected_cand = found[0]
            if not selected_cand["has_stock"]:
                 # We might raise error or allow overbooking? Let's be strict.
                 pass # Will fail at freeze step if we don't catch here.
        else:
            # Auto selection:
            # 1. Prefer has_stock
            # 2. Lowest price
            valid_cands = [c for c in candidate_prices if c["has_stock"]]
            if not valid_cands:
                # Fallback to any candidate to report "Out of Stock" properly later? 
                # Or pick lowest price one and let it fail at freeze.
                # Let's pick lowest price among ALL to attempt.
                valid_cands = candidate_prices
            
            if not valid_cands:
                 raise HTTPException(status_code=400, detail=f"No valid suppliers for resource {line.resource_id}")
                 
            # Sort by price
            valid_cands.sort(key=lambda x: x["price"])
            selected_cand = valid_cands[0]
            
        # Add to order resources
        unit_cost = selected_cand["price"]
        line_cost = unit_cost * Decimal(line.quantity) # Cost per product unit
        calculated_cost += line_cost
        
        order_resources_data.append({
            "resource_id": line.resource_id,
            "supplier_id": selected_cand["supplier_id"],
            "supplier_resource_id": selected_cand["supplier_resource_id"],
            "quantity": line.quantity * payload.quantity, # Total qty for whole order
            "settlement_price": unit_cost,
            "cost_amount": unit_cost * Decimal(line.quantity * payload.quantity)
        })

    calculated_cost = calculated_cost * Decimal(payload.quantity) # Total Cost

    active_price = await _active_price(db, payload.sku_id, payload.channel_id, payload.travel_date)
    sale_price = Decimal(str(payload.sale_price or (active_price.sale_price if active_price else 0)))
    
    # Use calculated dynamic cost if payload doesn't provide it
    cost_price = Decimal(str(payload.cost_price)) if payload.cost_price is not None else (calculated_cost / Decimal(payload.quantity) if payload.quantity > 0 else 0)
    
    sale_amount, cost_amount, profit_amount = _calc_amounts(sale_price, cost_price, payload.quantity)

    # 3. Create Order
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

    # 4. Create Order Resources and Freeze Resource Inventory
    for item in order_resources_data:
        # Create DB record
        or_rec = OrderResource(
            order_id=order.id,
            resource_id=item["resource_id"],
            supplier_id=item["supplier_id"],
            quantity=item["quantity"],
            settlement_price=item["settlement_price"],
            cost_amount=item["cost_amount"]
        )
        db.add(or_rec)
        
        # Freeze Resource Inventory
        # Look up inventory again to lock
        inv = await db.scalar(
            select(ResourceInventory).where(
                ResourceInventory.supplier_resource_id == item["supplier_resource_id"],
                ResourceInventory.inventory_date == payload.travel_date
            ).with_for_update()
        )
        
        if not inv:
             raise HTTPException(status_code=400, detail=f"Inventory record missing for resource {item['resource_id']} supplier {item['supplier_id']}")
        
        avail = inv.total_qty - inv.frozen_qty - inv.sold_qty
        if avail < item["quantity"]:
             raise HTTPException(status_code=400, detail=f"Inventory insufficient for resource {item['resource_id']} supplier {item['supplier_id']}")
             
        inv.frozen_qty += item["quantity"]
        inv.updated_at = now_china()
        db.add(inv)

    # 5. Freeze SKU Inventory (if used)
    # We still do this for backward compatibility or if they use SKU-level limits
    try:
        await _freeze_inventory(db, payload.sku_id, payload.travel_date, payload.quantity, user.username, order.id)
    except HTTPException as e:
        # It's possible SKU inventory isn't initialized if we only use ResourceInventory
        # But for now, let's assume if it fails, we shouldn't block if we successfully froze resources?
        # NO, if the system was using SKU inventory, we must respect it.
        # But if the user didn't initialize SKU inventory, this might fail.
        # Let's keep it strict for now as per previous logic.
        raise e

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
