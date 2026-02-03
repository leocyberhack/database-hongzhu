from datetime import datetime, timedelta
import math
from app.utils.time import now_china
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, exists, func, select

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import (
    Approval,
    AuditLog,
    Inventory,
    InventoryLog,
    Product,
    ProductResource,
    ResourceInventory,
    Sku,
    SkuChannel,
    Spu,
    SupplierResource,
)
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
    keyword: Optional[str] = Query(default=None),
    channel_id: Optional[int] = Query(default=None),
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
):
    try:
        target = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD")

    channel_subq = (
        select(SkuChannel.sku_id, func.min(SkuChannel.channel_id).label("channel_id"))
        .where(SkuChannel.status == "active")
        .group_by(SkuChannel.sku_id)
        .subquery()
    )

    stmt = (
        select(
            Sku.id.label("sku_id"),
            Sku.sku_name,
            Sku.spu_id,
            Spu.name.label("spu_name"),
            Sku.product_id,
            channel_subq.c.channel_id,
            Inventory.id.label("inventory_id"),
            Inventory.frozen_qty,
            Inventory.sold_qty,
            Inventory.status.label("inventory_status"),
        )
        .select_from(Sku)
        .outerjoin(Spu, Spu.id == Sku.spu_id)
        .outerjoin(channel_subq, channel_subq.c.sku_id == Sku.id)
        .outerjoin(
            Inventory,
            and_(Inventory.sku_id == Sku.id, Inventory.inventory_date == target),
        )
    )
    if keyword:
        stmt = stmt.where(Sku.sku_name.ilike(f"%{keyword}%"))
    if channel_id is not None:
        stmt = stmt.where(
            exists(
                select(1).where(
                    SkuChannel.sku_id == Sku.id,
                    SkuChannel.channel_id == channel_id,
                    SkuChannel.status == "active",
                )
            )
        )
    
    result = await db.execute(stmt)
    rows = result.all()

    product_ids = {row.product_id for row in rows if row.product_id}
    product_map: dict[int, Product] = {}
    if product_ids:
        products = list(await db.scalars(select(Product).where(Product.id.in_(product_ids))))
        product_map = {p.id: p for p in products}

    product_resources = []
    if product_ids:
        product_resources = list(
            await db.scalars(select(ProductResource).where(ProductResource.product_id.in_(product_ids)))
        )

    pr_by_product: dict[int, list[ProductResource]] = {}
    for pr in product_resources:
        if not pr.required_flag:
            continue
        pr_by_product.setdefault(pr.product_id, []).append(pr)

    resource_ids = {pr.resource_id for prs in pr_by_product.values() for pr in prs}
    resource_total: dict[int, int] = {}
    resource_by_supplier: dict[tuple[int, int], int] = {}
    if resource_ids:
        inv_stmt = (
            select(ResourceInventory, SupplierResource.resource_id, SupplierResource.supplier_id)
            .join(SupplierResource)
            .where(
                SupplierResource.resource_id.in_(resource_ids),
                ResourceInventory.inventory_date == target,
            )
        )
        for inv, r_id, s_id in (await db.execute(inv_stmt)).all():
            available = max(0, inv.total_qty - inv.sold_qty - inv.frozen_qty)
            resource_total[r_id] = resource_total.get(r_id, 0) + available
            resource_by_supplier[(r_id, s_id)] = resource_by_supplier.get((r_id, s_id), 0) + available

    product_qty_map: dict[int, int] = {}
    for pid, prs in pr_by_product.items():
        min_qty = None
        for pr in prs:
            if pr.supplier_mode == "locked" and pr.supplier_ids:
                resource_available = sum(
                    resource_by_supplier.get((pr.resource_id, sid), 0) for sid in pr.supplier_ids
                )
            else:
                resource_available = resource_total.get(pr.resource_id, 0)
            qty_from_resource = resource_available // pr.quantity if pr.quantity > 0 else 0
            min_qty = qty_from_resource if min_qty is None else min(min_qty, qty_from_resource)
        product_qty_map[pid] = min_qty if min_qty is not None else 0

    items = []
    for row in rows:
        resolved_channel_id = channel_id if channel_id is not None else row.channel_id
        ratio = 0
        product = product_map.get(row.product_id)
        if product and resolved_channel_id is not None and product.allowed_channels:
            for alloc in product.allowed_channels:
                if isinstance(alloc, dict):
                    if alloc.get("channel_id") == resolved_channel_id:
                        ratio = alloc.get("stock_ratio", 0) or 0
                        if alloc.get("stock_ratio") is None:
                            ratio = 100
                        break
                    continue
                try:
                    cid = int(alloc)
                except (TypeError, ValueError):
                    continue
                if cid == resolved_channel_id:
                    ratio = 100
                    break

        product_qty = product_qty_map.get(row.product_id, 0)
        total_qty = int(math.floor(product_qty * (ratio / 100))) if ratio > 0 else 0
        frozen_qty = row.frozen_qty or 0
        sold_qty = row.sold_qty or 0
        available = max(0, total_qty - frozen_qty - sold_qty)
        payload = InventoryDayRead(
            id=row.inventory_id or 0,
            sku_id=row.sku_id,
            channel_id=resolved_channel_id,
            inventory_date=target,
            total_qty=total_qty,
            frozen_qty=frozen_qty,
            sold_qty=sold_qty,
            available_qty=available,
            status=row.inventory_status or "normal",
        ).model_dump()
        payload["sku_name"] = row.sku_name
        payload["spu_id"] = row.spu_id
        payload["spu_name"] = row.spu_name
        items.append(payload)

    reverse = sort_order == "descend"
    if sort_field in {"total_qty", "frozen_qty", "sold_qty", "available_qty"}:
        items.sort(
            key=lambda x: (
                x.get(sort_field, 0),
                x.get("spu_name") or "",
                x.get("sku_name") or "",
                x.get("sku_id") or 0,
            ),
            reverse=reverse,
        )
    elif sort_field == "spu_name":
        items.sort(
            key=lambda x: (
                x.get("spu_name") or "",
                x.get("sku_name") or "",
                x.get("sku_id") or 0,
            ),
            reverse=reverse,
        )
    elif sort_field == "sku_name" or not sort_field:
        items.sort(
            key=lambda x: (
                x.get("spu_name") or "",
                x.get("sku_name") or "",
                x.get("sku_id") or 0,
            ),
            reverse=reverse,
        )
    elif sort_field == "sku_id":
        items.sort(
            key=lambda x: (x.get("spu_name") or "", x.get("sku_id") or 0),
            reverse=reverse,
        )
    else:
        items.sort(
            key=lambda x: (x.get("spu_name") or "", x.get("sku_id") or 0),
            reverse=reverse,
        )

    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    items = items[start:end]

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
    raise HTTPException(status_code=400, detail="SKU库存由产品资源自动计算，已禁用手动设置")
    sku = await db.get(Sku, payload.sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU 不存在")

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

    # Validate: new total cannot be less than sold + frozen
    invalid_dates = []
    for d in _date_range(payload.start_date, payload.end_date):
        if payload.weekdays is not None and d.weekday() not in payload.weekdays:
            continue
        inv = existing_map.get(d)
        if inv and payload.total_qty < (inv.sold_qty + inv.frozen_qty):
            invalid_dates.append(
                {
                    "date": d,
                    "sold": inv.sold_qty,
                    "frozen": inv.frozen_qty,
                }
            )
    if invalid_dates:
        sample = invalid_dates[0]
        raise HTTPException(
            status_code=400,
            detail=(
                f"总库存不能小于已售+冻结。冲突日期数: {len(invalid_dates)}，"
                f"示例: {sample['date']} (已售 {sample['sold']}，冻结 {sample['frozen']})"
            ),
        )
    
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
    raise HTTPException(status_code=400, detail="SKU库存由产品资源自动计算，已禁用手动调整")
    inv = await db.scalar(
        select(Inventory)
        .where(Inventory.sku_id == payload.sku_id, Inventory.inventory_date == payload.inventory_date)
        .with_for_update()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="库存记录不存在")

    min_required = inv.sold_qty + inv.frozen_qty
    if payload.total_qty < min_required:
        raise HTTPException(
            status_code=400,
            detail=f"总库存不能小于已售+冻结 (已售 {inv.sold_qty}，冻结 {inv.frozen_qty})",
        )

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
