from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field

from app.schemas.common import ORMBase


class InventoryInit(BaseModel):
    sku_id: int
    start_date: date
    end_date: date
    total_qty: int = Field(..., ge=0)
    reason: Optional[str] = None
    weekdays: Optional[List[int]] = None


class InventoryAdjust(BaseModel):
    sku_id: int
    inventory_date: date
    total_qty: int = Field(..., ge=0)
    remark: Optional[str] = None


class InventoryRead(ORMBase):
    id: int
    sku_id: int
    inventory_date: date
    total_qty: int
    frozen_qty: int
    sold_qty: int
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class InventoryLogRead(ORMBase):
    id: int
    sku_id: int
    inventory_date: date
    change_type: str
    before_qty: dict
    after_qty: dict
    related_order_id: Optional[int] = None
    operator: Optional[str] = None
    operated_at: datetime
    remark: Optional[str] = None
