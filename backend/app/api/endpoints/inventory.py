from datetime import datetime, timedelta
from app.utils.time import now_china
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import Approval, AuditLog, Inventory, InventoryLog, Sku, SkuChannel
from app.schemas.common import ListResponse, Pagination
from app.schemas.inventory import InventoryAdjust, InventoryInit, InventoryLogRead, InventoryRead, InventoryDayRead

router = APIRouter()


def _date_range(start, end):
    cursor = start
    while cursor <= end:
        yield cursor
        cursor += timedelta(days=1)


@router.get("/inventory", response_model=ListResponse)
async def list_inventory(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
    sku_id: Optional[int] = Query(default=None),
):
    stmt = select(Inventory)
    if sku_id:
        stmt = stmt.where(Inventory.sku_id == sku_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(Inventory.inventory_date).offset((page - 1) * page_size).limit(page_size))
    items = []
    for r in rows:
        available = max(0, r.total_qty - r.frozen_qty - r.sold_qty)
        items.append(
            InventoryRead(
                id=r.id,
                sku_id=r.sku_id,
                inventory_date=r.inventory_date,
                total_qty=r.total_qty,
                frozen_qty=r.frozen_qty,
                sold_qty=r.sold_qty,
                available_qty=available,
                status=r.status,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )
    return ListResponse(
        items=items,
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/inventory/day", response_model=ListResponse)
async def list_inventory_by_day(
    db: DbSession,
    _: User = Depends(get_current_user),
    date: str = Query(..., description="日期 YYYY-MM-DD"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
):
    try:
        target = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")

    stmt = select(Inventory).join(Sku, Inventory.sku_id == Sku.id).where(Inventory.inventory_date == target)
    
    # Sorting logic
    if sort_field == "sku_name" or not sort_field:
        if sort_order == "descend":
            stmt = stmt.order_by(Sku.sku_name.desc(), Sku.poi_id.asc())
        else:
            stmt = stmt.order_by(Sku.sku_name.asc(), Sku.poi_id.asc())
    elif sort_field and hasattr(Inventory, sort_field):
        field = getattr(Inventory, sort_field)
        if sort_order == "descend":
            stmt = stmt.order_by(field.desc())
        else:
            stmt = stmt.order_by(field.asc())
    else:
        stmt = stmt.order_by(Inventory.sku_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    rows = list(rows)

    # Map SKU -> channel (assuming单渠道绑定；多渠道取首个绑定)
    sku_ids = [r.sku_id for r in rows]
    channel_map = {}
    if sku_ids:
        bindings = await db.scalars(select(SkuChannel).where(SkuChannel.sku_id.in_(sku_ids)))
        for b in bindings:
            if b.sku_id not in channel_map:
                channel_map[b.sku_id] = b.channel_id

    items = []
    for r in rows:
        available = max(0, r.total_qty - r.frozen_qty - r.sold_qty)
        items.append(
            InventoryDayRead(
                id=r.id,
                sku_id=r.sku_id,
                channel_id=channel_map.get(r.sku_id),
                inventory_date=r.inventory_date,
                total_qty=r.total_qty,
                frozen_qty=r.frozen_qty,
                sold_qty=r.sold_qty,
                available_qty=available,
                status=r.status,
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )

    return ListResponse(
        items=items,
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/inventory/logs", response_model=ListResponse)
async def list_inventory_logs(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=1000),
    sku_id: Optional[int] = Query(default=None),
):
    stmt = select(InventoryLog)
    if sku_id:
        stmt = stmt.where(InventoryLog.sku_id == sku_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(InventoryLog.operated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[InventoryLogRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/inventory/init", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
async def init_inventory(
    payload: InventoryInit,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "product", "operator", "csr"])),
):
    sku = await db.get(Sku, payload.sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")

    created = []
    # Optimization: Do not create per-day InventoryLog for batch init to avoid log explosion.
    # Rely on the aggregated AuditLog at the end of the function for tracking.
    
    # Optimization: Fetch all existing inventory record in the date range first
    stmt = select(Inventory).where(
        Inventory.sku_id == payload.sku_id,
        Inventory.inventory_date >= payload.start_date,
        Inventory.inventory_date <= payload.end_date
    )
    existing_records = await db.scalars(stmt)
    existing_map = {r.inventory_date: r for r in existing_records}
    
    before_total_qty = 0
    after_total_qty = 0
    records_updated = 0
    records_created = 0

    for d in _date_range(payload.start_date, payload.end_date):
        if payload.weekdays is not None and d.weekday() not in payload.weekdays:
            continue
        
        inv = existing_map.get(d)
        if inv:
            # Update existing
            before_total_qty += inv.total_qty
            inv.total_qty = payload.total_qty
            inv.updated_at = now_china()
            created.append(inv)
            records_updated += 1
        else:
            # Create new
            new_inv = Inventory(
                sku_id=payload.sku_id,
                inventory_date=d,
                total_qty=payload.total_qty,
                frozen_qty=0,
                sold_qty=0,
                status="normal",
            )
            created.append(new_inv)
            records_created += 1
            
        after_total_qty += payload.total_qty
            
    db.add_all(created)
    
    # Record audit log for batch inventory init with Before/After stats
    audit = AuditLog(
        table_name="inventory",
        record_id=payload.sku_id,
        operation="BATCH_INIT",
        diff_data={
            "sku_id": payload.sku_id,
            "date_range": f"{payload.start_date} ~ {payload.end_date}",
            "set_total_qty": payload.total_qty,
            "stats": {
                "records_updated": records_updated,
                "records_created": records_created,
                "before_sum_qty": before_total_qty,
                "after_sum_qty": after_total_qty,
                "change_qty": after_total_qty - before_total_qty
            }
        },
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    await db.commit()
    # Return first page of inventory for this SKU after initialization
    return await list_inventory(db, user, page=1, page_size=50, sku_id=payload.sku_id)


@router.post("/inventory/adjust", response_model=InventoryRead)
async def adjust_inventory(
    payload: InventoryAdjust,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "product", "operator", "csr"])),
):
    inv = await db.scalar(
        select(Inventory)
        .where(Inventory.sku_id == payload.sku_id, Inventory.inventory_date == payload.inventory_date)
        .with_for_update()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory record not found")

    before = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    inv.total_qty = payload.total_qty
    inv.updated_at = now_china()
    after = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}

    log = InventoryLog(
        sku_id=payload.sku_id,
        inventory_date=payload.inventory_date,
        change_type="manual_adjust",
        before_qty=before,
        after_qty=after,
        operator=user.username,
        operated_at=now_china(),
        remark=payload.remark,
    )
    # approval creation removed per user request: "other operations do not need approval"

    audit = AuditLog(
        table_name="inventory",
        record_id=inv.id,
        operation="UPDATE",
        diff_data={"before": before, "after": after},
        operator=user.username,
        operated_at=now_china(),
        source="manual_adjust",
    )
    db.add_all([inv, log, audit])
    await db.commit()
    await db.refresh(inv)
    return InventoryRead.model_validate(inv)
