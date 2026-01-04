from datetime import date, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import Inventory, Price, Sku, SkuChannel

router = APIRouter()


@router.get("/skus/{sku_id}/shelf-gate")
async def sku_shelf_gate(
    db: DbSession,
    sku_id: int = Path(..., ge=1),
    _: User = Depends(get_current_user),
):
    sku = await db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU 不存在")

    missing: List[str] = []

    has_channel = await db.scalar(
        select(SkuChannel.id).where(SkuChannel.sku_id == sku_id, SkuChannel.status == "active").limit(1)
    )
    if not has_channel:
        missing.append("未绑定渠道")

    has_price = await db.scalar(
        select(Price.id).where(Price.sku_id == sku_id, Price.status == "active").limit(1)
    )
    if not has_price:
        missing.append("缺生效价格")

    today = date.today()
    deadline = today + timedelta(days=7)
    inv = await db.scalar(
        select(Inventory.id).where(
            Inventory.sku_id == sku_id,
            Inventory.inventory_date >= today,
            Inventory.inventory_date <= deadline,
            (Inventory.total_qty - Inventory.frozen_qty - Inventory.sold_qty) > 0,
        )
    )
    if not inv:
        missing.append("未来7天无库存")

    return {"sku_id": sku_id, "missing": missing, "pass": len(missing) == 0}
