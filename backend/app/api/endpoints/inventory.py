from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import Approval, AuditLog, Inventory, InventoryLog, Sku
from app.schemas.common import ListResponse, Pagination
from app.schemas.inventory import InventoryAdjust, InventoryInit, InventoryLogRead, InventoryRead

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
    return ListResponse(
        items=[InventoryRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/inventory/logs", response_model=ListResponse)
async def list_inventory_logs(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
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
    user: User = Depends(require_roles(["admin", "manager", "operator"])),
):
    sku = await db.get(Sku, payload.sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU 涓嶅瓨鍦?)

    created = []
    logs = []
    for d in _date_range(payload.start_date, payload.end_date):
        if payload.weekdays is not None and d.weekday() not in payload.weekdays:
            continue
        
        inv = await db.scalar(
            select(Inventory).where(Inventory.sku_id == payload.sku_id, Inventory.inventory_date == d).with_for_update()
        )
        if inv:
            before = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
            inv.total_qty = payload.total_qty
            inv.updated_at = datetime.utcnow()
            after = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
            logs.append(
                InventoryLog(
                    sku_id=payload.sku_id,
                    inventory_date=d,
                    change_type="init_adjust",
                    before_qty=before,
                    after_qty=after,
                    operator=user.username,
                    operated_at=datetime.utcnow(),
                    remark=payload.reason,
                )
            )
            created.append(inv)
        else:
            new_inv = Inventory(
                sku_id=payload.sku_id,
                inventory_date=d,
                total_qty=payload.total_qty,
                frozen_qty=0,
                sold_qty=0,
                status="normal",
            )
            created.append(new_inv)
            logs.append(
                InventoryLog(
                    sku_id=payload.sku_id,
                    inventory_date=d,
                    change_type="init",
                    before_qty={"total": 0, "frozen": 0, "sold": 0},
                    after_qty={"total": payload.total_qty, "frozen": 0, "sold": 0},
                    operator=user.username,
                    operated_at=datetime.utcnow(),
                    remark=payload.reason,
                )
            )
    db.add_all(created)
    db.add_all(logs)
    await db.commit()
    # 杩斿洖鏈€鏂板垎椤佃鍥?    return await list_inventory(db, user, page=1, page_size=50, sku_id=payload.sku_id)


@router.post("/inventory/adjust", response_model=InventoryRead)
async def adjust_inventory(
    payload: InventoryAdjust,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "manager"])),
):
    inv = await db.scalar(
        select(Inventory)
        .where(Inventory.sku_id == payload.sku_id, Inventory.inventory_date == payload.inventory_date)
        .with_for_update()
    )
    if not inv:
        raise HTTPException(status_code=404, detail="搴撳瓨璁板綍涓嶅瓨鍦?)

    before = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}
    inv.total_qty = payload.total_qty
    inv.updated_at = datetime.utcnow()
    after = {"total": inv.total_qty, "frozen": inv.frozen_qty, "sold": inv.sold_qty}

    log = InventoryLog(
        sku_id=payload.sku_id,
        inventory_date=payload.inventory_date,
        change_type="manual_adjust",
        before_qty=before,
        after_qty=after,
        operator=user.username,
        operated_at=datetime.utcnow(),
        remark=payload.remark,
    )
    approval = Approval(
        object_type="inventory",
        object_id=inv.id,
        action_type="浜哄伐璋冩暣",
        before_data=before,
        after_data=after,
        status="pending",
        applicant=user.username,
        approver="manager",
        applied_at=datetime.utcnow(),
    )
    audit = AuditLog(
        table_name="inventory",
        record_id=inv.id,
        operation="UPDATE",
        diff_data={"before": before, "after": after},
        operator=user.username,
        operated_at=datetime.utcnow(),
        source="manual_adjust",
    )
    db.add_all([inv, log, approval, audit])
    await db.commit()
    await db.refresh(inv)
    return InventoryRead.model_validate(inv)
