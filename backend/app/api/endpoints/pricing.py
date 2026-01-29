from datetime import datetime, timedelta
from app.utils.time import now_china
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import and_, func, or_, select, update, desc, cast, Date

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import AuditLog, Approval, Channel, Price, PriceHistory, Sku, Product
from app.schemas.common import ListResponse, Pagination
from app.schemas.price import ChannelCreate, ChannelRead, PriceCreate, PriceDecision, PriceRead, PriceHistoryRead
from pydantic import BaseModel

class PricingSummaryItem(BaseModel):
    sku_id: int
    channel_id: int
    sku_name: str
    channel_name: str
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    status: str # 'active' if has active prices, else 'empty' or 'expired'

class PricingSummaryResponse(ListResponse):
    items: list[PricingSummaryItem]

router = APIRouter()

EXPIRED_STATUSES = {"expired", "rejected"}


# Duplicate channel endpoints removed - use app/api/endpoints/channels.py instead


def _overlap_filter(start_at, end_at):
    return or_(
        and_(Price.start_at <= start_at, Price.end_at >= start_at),
        and_(Price.start_at <= end_at, Price.end_at >= end_at),
        and_(Price.start_at >= start_at, Price.end_at <= end_at),
    )


async def _find_conflicts(db: DbSession, sku_id: int, channel_id: int, start_at, end_at, exclude_id: Optional[int] = None):
    stmt = select(Price).where(
        Price.sku_id == sku_id,
        Price.channel_id == channel_id,
        ~Price.status.in_(EXPIRED_STATUSES),
        _overlap_filter(start_at, end_at),
    )
    if exclude_id:
        stmt = stmt.where(Price.id != exclude_id)
    rows = await db.scalars(stmt)
    return list(rows)


async def _has_range_collision(db: DbSession, price: Price, start_at, end_at) -> bool:
    collision = await db.scalar(
        select(Price.id).where(
            Price.sku_id == price.sku_id,
            Price.channel_id == price.channel_id,
            Price.start_at == start_at,
            Price.end_at == end_at,
            Price.id != price.id,
        )
    )
    return collision is not None


async def _resolve_active_overlap(db: DbSession, price: Price, new_start, new_end) -> list[Price]:
    """
    Adjust an active price to remove overlap with [new_start, new_end].
    Returns new Price rows that should be added (e.g., right segment when splitting).
    """
    # Case 1: New fully covers old -> expire old
    if new_start <= price.start_at and new_end >= price.end_at:
        price.status = "expired"
        return []

    # Case 2: Old fully covers new -> split into left + right
    if price.start_at < new_start and price.end_at > new_end:
        left_end = new_start - timedelta(days=1)
        right_start = new_end + timedelta(days=1)
        right_end = price.end_at

        if await _has_range_collision(db, price, price.start_at, left_end):
            price.status = "expired"
            return []

        price.end_at = left_end
        new_rows: list[Price] = []
        if right_start <= right_end and not await _has_range_collision(db, price, right_start, right_end):
            new_rows.append(
                Price(
                    sku_id=price.sku_id,
                    channel_id=price.channel_id,
                    sale_price=price.sale_price,
                    cost_price=price.cost_price,
                    start_at=right_start,
                    end_at=right_end,
                    status=price.status,
                    created_by=price.created_by,
                )
            )
        return new_rows

    # Case 3: Overlaps tail -> truncate end
    if price.start_at < new_start and price.end_at <= new_end:
        new_end_at = new_start - timedelta(days=1)
        if await _has_range_collision(db, price, price.start_at, new_end_at):
            price.status = "expired"
            return []
        price.end_at = new_end_at
        return []

    # Case 4: Overlaps head -> shift start
    if price.start_at >= new_start and price.start_at <= new_end and price.end_at > new_end:
        new_start_at = new_end + timedelta(days=1)
        if await _has_range_collision(db, price, new_start_at, price.end_at):
            price.status = "expired"
            return []
        price.start_at = new_start_at
        return []

    return []


@router.get("/pricing/summary", response_model=PricingSummaryResponse)
async def list_pricing_summary(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
    sku_id: Optional[int] = Query(default=None),
    channel_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
):
    # Retrieve all SKUs and Channels
    # Optimization: Filter SKUs first if sku_id is provided
    sku_stmt = select(Sku).join(Product)
    if sku_id:
        sku_stmt = sku_stmt.where(Sku.id == sku_id)
    
    # Sorting logic for SKUs
    # Default: SKU Name asc, then POI asc
    if sort_field == "sku_name" or not sort_field:
        if sort_order == "descend":
            sku_stmt = sku_stmt.order_by(Sku.sku_name.desc(), Sku.poi_id.asc())
        else:
            sku_stmt = sku_stmt.order_by(Sku.sku_name.asc(), Sku.poi_id.asc())
    # Note: If sort_field is price or status, we must sort in-memory later.
    else:
        # Fallback to ID sort for stability if sorting by non-DB field
        sku_stmt = sku_stmt.order_by(Sku.id)
    
    # We fetch SKUs first. 
    # Since we need to paginate the *combinations*, and we don't know how many channels are allowed per SKU without checking,
    # we can fetch a batch of SKUs, expand them, and stop when we reach page_size.
    # However, standard 'page' offset is tricky with dynamic expansion.
    # Simplification for MVP:
    # 1. Fetch ALL Channels (channels are usually few, e.g. < 50)
    # 2. Fetch SKUs with standard pagination (assuming roughly constant channels per SKU, or just paginating SKUs)
    #    If we paginate SKUs, the frontend page size means "SKUs per page", not "Rows per page".
    #    But the frontend expects "Rows".
    #    Let's stick to "Paginate by SKU" for stability. The table might show varying number of rows.
    #    Or better: fetch a chunk of SKUs, expand, and slice.
    
    # Let's try fetching ALL relevant SKUs and Channels efficiently if total count is small.
    # If 1000 SKUs * 5 Channels = 5000 rows. Doable in memory for now.
    
    all_channels = (await db.scalars(select(Channel))).all()
    all_skus = (await db.scalars(sku_stmt)).all()
    
    # Group active prices for bulk lookup
    # Key: (sku_id, channel_id) -> (min, max)
    active_now = datetime.now().date()
    stats_stmt = (
        select(Price.sku_id, Price.channel_id, func.min(Price.sale_price), func.max(Price.sale_price))
        .where(
            Price.status == 'active',
            Price.end_at >= active_now,
            Price.start_at <= active_now + timedelta(days=365)
        )
        .group_by(Price.sku_id, Price.channel_id)
    )
    price_stats = (await db.execute(stats_stmt)).all()
    stats_map = { (r[0], r[1]): (r[2], r[3]) for r in price_stats }
    
    # Build full list
    full_items = []
    
    # Cache product allowed_channels
    # Since we joined Product, we can access Sku.product (if lazy loaded or contains eager load).
    # Sku model doesn't explicitly show `product` relationship in some versions, let's check or fetch Product map.
    # To be safe and fast: Fetch {product_id: allowed_channels} map.
    
    # Extract distinct product IDs from SKUs
    p_ids = list(set(s.product_id for s in all_skus))
    # Fetch products
    if p_ids:
        products = (await db.scalars(select(Product).where(Product.id.in_(p_ids)))).all()
        p_map = { p.id: p.allowed_channels for p in products }
    else:
        p_map = {}

    for sku in all_skus:
        allowed = p_map.get(sku.product_id)
        
        # Normalize allowed_channels to a set of channel IDs (supports list of int or list of dicts with channel_id)
        allowed_ids = set()
        if allowed:
            for a in allowed:
                if isinstance(a, dict):
                    cid = a.get("channel_id")
                    if cid is not None:
                        allowed_ids.add(int(cid))
                else:
                    try:
                        allowed_ids.add(int(a))
                    except Exception:
                        continue
        
        if not allowed_ids:
            valid_channels = all_channels
        else:
            valid_channels = [c for c in all_channels if c.id in allowed_ids]
            
        for ch in valid_channels:
            if channel_id and ch.id != channel_id:
                continue
                
            p_min, p_max = stats_map.get((sku.id, ch.id), (None, None))
            
            full_items.append(PricingSummaryItem(
                sku_id=sku.id,
                channel_id=ch.id,
                sku_name=sku.sku_name,
                channel_name=ch.channel_name,
                min_price=float(p_min) if p_min is not None else None,
                max_price=float(p_max) if p_max is not None else None,
                status='active' if p_min is not None else 'empty'
            ))
            
    if status in {"active", "empty"}:
        full_items = [item for item in full_items if item.status == status]

    # In-memory Pagination
    total = len(full_items)
    start = (page - 1) * page_size
    end = start + page_size
    paged_items = full_items[start:end]
    
    return PricingSummaryResponse(
        items=paged_items,
        pagination=Pagination(total=total, page=page, page_size=page_size),
    )


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
    
    # Sort by start_at to show calendar order logic usually, or ID for creation order
    stmt = stmt.order_by(Price.start_at.desc())
    
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[PriceRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/price-history", response_model=ListResponse)
async def list_price_history(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=1000),
    price_id: Optional[int] = Query(default=None),
):
    stmt = select(PriceHistory)
    if price_id:
        stmt = stmt.where(PriceHistory.price_id == price_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(PriceHistory.operated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[PriceHistoryRead.model_validate(row) for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/prices", response_model=PriceRead, status_code=status.HTTP_201_CREATED)
async def create_price(
    payload: PriceCreate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product", "operator", "csr"])),
    ):
    # Instead of blocking conflicts, we should handle them if they are 'active' prices.
    # Logic:
    # 1. New price is "preferred" for its duration.
    # 2. If it overlaps with existing ACTIVE prices, those prices need to be adjusted (truncated) or split.
    #    However, splitting is complex. 
    #    A simpler "Replacement" logic: 
    #    - If overlapping with 'active', we can mark the *overlapped portion* as superseded.
    #    But current data model is simple: Price row has start/end.
    #    The 'conflicts' check blocks overlap.
    
    # FOR NOW: To fix the user error "Time overlap", we will implement:
    # "If overwrite is intended, use a different flow or auto-archive the old ones?"
    # The user is using the Calendar UI. They likely expect "I set price for Jan 1st, so Jan 1st is THIS price".
    # They don't want to receive "Overlap error". They want the system to "Make it so".
    
    # Strategy:
    # 1. Find conflicting ACTIVE prices.
    # 2. If conflicting price is overlapping, we must "cut" holes in it or expire it.
    #    Cutting holes (e.g. Price A is Jan 1-31. New Price B is Jan 15-16. result: A becomes Jan 1-14, new A' Jan 17-31) is hard.
    # 
    #    Simplest robust strategy for MVP:
    #    - If new price completely covers old price: Expire old price.
    #    - If overlap is partial: 
    #      Rejecting is easiest for data integrity, BUT looking at the user request "Why did it error", they want it resolved.
    #      
    #    Let's relax the constraint: The Calendar Editor sends Day-by-Day or Segments.
    #    If the Calendar Editor sends "Jan 1: 100", and DB has "Jan 1-5: 50", we must update.
    
    # Check for exact duplicate frame (including expired) to avoid Unique Constraint Violation
    existing_exact = await db.scalar(
        select(Price).where(
            Price.sku_id == payload.sku_id,
            Price.channel_id == payload.channel_id,
            Price.start_at == payload.start_at,
            Price.end_at == payload.end_at
        )
    )

    # Re-fetch conflicts
    conflicts = await _find_conflicts(
        db, 
        payload.sku_id, 
        payload.channel_id, 
        payload.start_at, 
        payload.end_at, 
        exclude_id=existing_exact.id if existing_exact else None
    )

    # Calculate before/after diff for audit log
    before_prices_info = []
    for p in conflicts:
         before_prices_info.append({
             "start_at": str(p.start_at),
             "end_at": str(p.end_at),
             "price": str(p.sale_price)
         })
    if existing_exact:
        before_prices_info.append({
             "start_at": str(existing_exact.start_at),
             "end_at": str(existing_exact.end_at),
             "price": str(existing_exact.sale_price)
        })
    
    for c in conflicts:
        # If conflict is PENDING
        if c.status == 'pending':
             if user.role in ['admin', 'super_admin']:
                 c.status = 'expired'
                 db.add(c)
             else:
                 raise HTTPException(status_code=400, detail="Pending price conflicts exist; only admin or super_admin can override")
        
        # If conflict is ACTIVE, we adjust it
        elif c.status == 'active':
            new_rows = await _resolve_active_overlap(db, c, payload.start_at, payload.end_at)
            for row in new_rows:
                db.add(row)
            db.add(c)

    if existing_exact:
        # Reuse/Revive existing record to satisfy unique constraint
        
        # Check permission if overriding a pending record
        if existing_exact.status == 'pending' and user.role not in ['admin', 'super_admin']:
             raise HTTPException(status_code=400, detail="Pending price exists for this exact date range; only admin can override")
             
        obj = existing_exact
        obj.sale_price = Decimal(str(payload.sale_price))
        obj.cost_price = Decimal(str(payload.cost_price)) if payload.cost_price is not None else None
        
        # Determine status
        target_status = payload.status or "pending"
        if user.role not in ["admin", "super_admin"]:
            target_status = "pending"
        obj.status = target_status
        
        obj.created_by = payload.created_by or user.username
        # start_at/end_at are already identical
        
        db.add(obj)
    else:
        # Determine status
        target_status = payload.status or "pending"
        if user.role not in ["admin", "super_admin"]:
            target_status = "pending"

        obj = Price(
            sku_id=payload.sku_id,
            channel_id=payload.channel_id,
            sale_price=Decimal(str(payload.sale_price)),
            cost_price=Decimal(str(payload.cost_price)) if payload.cost_price is not None else None,
            start_at=payload.start_at,
            end_at=payload.end_at,
            status=target_status,
            created_by=payload.created_by or user.username,
        )
        db.add(obj)
    
    # Flush to obtain ID before creating the related approval record.
    await db.flush()
    
    # Only create approval if status is pending
    if obj.status == "pending":
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
            approver="admin",
            applied_at=now_china(),
        )
        db.add(approval)
    
    # Record audit log for price creation
    audit = AuditLog(
        table_name="price",
        record_id=obj.id,
        operation="CREATE" if not existing_exact else "UPDATE",
        diff_data={
            "sku_id": obj.sku_id,
            "channel_id": obj.channel_id,
            "date_range": f"{obj.start_at} ~ {obj.end_at}",
            "set_price": str(obj.sale_price),
            "before_prices": before_prices_info
        },
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    await db.commit()
    await db.refresh(obj)
    return PriceRead.model_validate(obj)


@router.post("/prices/{price_id}/decision", response_model=PriceRead)
async def decide_price(
    payload: PriceDecision,
    db: DbSession,
    price_id: int = Path(..., ge=1),
    user: User = Depends(require_roles(["admin"])),
):
    price = await db.get(Price, price_id)
    if not price:
        raise HTTPException(status_code=404, detail="Price not found")

    if payload.approve:
        price.status = "active"
        # Adjust overlapping active prices for the same SKU and channel
        overlaps = await db.scalars(
            select(Price).where(
                Price.sku_id == price.sku_id,
                Price.channel_id == price.channel_id,
                Price.id != price.id,
                Price.status == "active",
                _overlap_filter(price.start_at, price.end_at),
            )
        )
        for ap in overlaps:
            before = {"status": ap.status, "start_at": ap.start_at.isoformat(), "end_at": ap.end_at.isoformat()}
            new_rows = await _resolve_active_overlap(db, ap, price.start_at, price.end_at)
            after = {"status": ap.status, "start_at": ap.start_at.isoformat(), "end_at": ap.end_at.isoformat()}
            if before != after:
                db.add(
                    PriceHistory(
                        price_id=ap.id,
                        before_data=before,
                        after_data=after,
                        operator=user.username,
                        operated_at=now_china(),
                    )
                )
            for row in new_rows:
                db.add(row)
        db.add(
            PriceHistory(
                price_id=price.id,
                before_data=None,
                after_data={"status": "active"},
                operator=user.username,
                operated_at=now_china(),
            )
        )
    else:
        price.status = "rejected"

    # Update related Approval record
    await db.execute(
        update(Approval)
        .where(Approval.object_type == "price", Approval.object_id == price.id, Approval.status == "pending")
        .values(status="approved" if payload.approve else "rejected", decided_at=now_china(), comment=payload.comment or "")
    )
    
    # Audit Log
    action_cn = "批准" if payload.approve else "驳回"
    audit = AuditLog(
        table_name="price",
        record_id=price.id,
        operation="审批决定",
        diff_data={
            "description": f"{action_cn}了 价格 调价 申请",
            "result": "已批准" if payload.approve else "已驳回",
            "comment": payload.comment
        },
        operator=user.username,
        operated_at=now_china(),
        source="approval_decision",
    )
    db.add(audit)

    db.add(price)
    await db.commit()
    await db.refresh(price)
    return PriceRead.model_validate(price)


@router.get("/sku/{sku_id}/channel/{channel_id}/inventory")
async def get_sku_channel_inventory(
    db: DbSession,
    sku_id: int = Path(..., ge=1),
    channel_id: int = Path(..., ge=1),
    start_date: str = Query(...),
    end_date: str = Query(...),
    _: User = Depends(get_current_user),
):
    """
    Calculate SKU inventory for a specific channel over a date range.
    
    SKU channel inventory = FLOOR(product_inventory * channel_stock_ratio / 100)
    
    Returns a list of { date, available_qty } for each date in range.
    """
    from datetime import timedelta
    from app.models import ProductResource, ResourceInventory, SupplierResource
    import math
    
    # Get SKU to find product
    sku = await db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    # Get Product
    product = await db.get(Product, sku.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Find channel allocation ratio from product.allowed_channels
    channel_ratio = 0
    if product.allowed_channels:
        for alloc in product.allowed_channels:
            if isinstance(alloc, dict):
                if alloc.get('channel_id') == channel_id:
                    channel_ratio = alloc.get('stock_ratio', 0) or 0
                    break
                continue
            try:
                cid = int(alloc)
            except (TypeError, ValueError):
                continue
            if cid == channel_id:
                channel_ratio = 100
                break
    
    # If ratio is 0, return empty inventory
    if channel_ratio <= 0:
        return {"items": [], "message": "No inventory allocated for this channel"}
    
    # Get all product resources (with quantities)
    resources_stmt = select(ProductResource).where(ProductResource.product_id == product.id)
    product_resources = list(await db.scalars(resources_stmt))
    
    if not product_resources:
        return {"items": [], "message": "Product has no linked resources"}
    required_resources = [pr for pr in product_resources if pr.required_flag]
    if not required_resources:
        return {"items": [], "message": "Product has no required resources"}
    
    # Parse date range
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")
    if start > end:
        raise HTTPException(status_code=400, detail="start_date cannot be later than end_date")
    
    # Get all resource IDs needed
    resource_ids = [pr.resource_id for pr in required_resources]
    
    # Fetch all resource inventories in the date range (Join SupplierResource)
    inv_stmt = select(ResourceInventory, SupplierResource.resource_id, SupplierResource.supplier_id).join(SupplierResource).where(
        SupplierResource.resource_id.in_(resource_ids),
        ResourceInventory.inventory_date >= start,
        ResourceInventory.inventory_date <= end
    )
    inventory_rows = (await db.execute(inv_stmt)).all()
    
    # Build lookups:
    # detailed_lookup: { (resource_id, supplier_id, date_str): qty } for specific supplier binding
    # total_lookup: { (resource_id, date_str): total_qty } for unbound resources
    detailed_lookup = {}
    total_lookup = {}
    
    for inv, r_id, s_id in inventory_rows:
        date_str = str(inv.inventory_date)
        available = max(0, inv.total_qty - inv.sold_qty - inv.frozen_qty)
        
        # Update detailed map
        detailed_key = (r_id, s_id, date_str)
        detailed_lookup[detailed_key] = detailed_lookup.get(detailed_key, 0) + available
        
        # Update total map
        total_key = (r_id, date_str)
        total_lookup[total_key] = total_lookup.get(total_key, 0) + available
    
    # Calculate SKU channel inventory for each date
    result = []
    current = start
    while current <= end:
        date_str = str(current)
        
        # First calculate product inventory: MIN(resource_available / resource_quantity)
        product_qty = None
        for pr in required_resources:
            # Determine which inventory pool to use
            if pr.supplier_id is not None:
                # Specific supplier bound
                resource_available = detailed_lookup.get((pr.resource_id, pr.supplier_id, date_str), 0)
            else:
                # No binding, use accumulated total
                resource_available = total_lookup.get((pr.resource_id, date_str), 0)
                
            if pr.quantity > 0:
                qty_from_resource = resource_available // pr.quantity
            else:
                qty_from_resource = 0
            
            if product_qty is None:
                product_qty = qty_from_resource
            else:
                product_qty = min(product_qty, qty_from_resource)
        
        product_qty = product_qty if product_qty is not None else 0
        
        # Then calculate channel inventory: FLOOR(product_qty * ratio / 100)
        channel_qty = math.floor(product_qty * channel_ratio / 100)
        
        result.append({
            "date": date_str,
            "available_qty": channel_qty
        })
        
        current += timedelta(days=1)
    
    return {"items": result}

