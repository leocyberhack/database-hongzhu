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

# Resource Inventory Schemas
class ResourceInventoryBase(BaseModel):
    supplier_resource_id: int
    inventory_date: date
    total_qty: int = Field(..., ge=0)
    frozen_qty: int = 0
    sold_qty: int = 0
    status: str = 'active'
    settlement_price: Optional[float] = None

class ResourceInventoryCreate(ResourceInventoryBase):
    pass

class ResourceInventoryUpdate(BaseModel):
    total_qty: int = Field(..., ge=0)
    settlement_price: Optional[float] = None

class ResourceInventoryRead(ResourceInventoryBase, ORMBase):
    id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ResourceInventoryBatchUpdate(BaseModel):
    supplier_resource_id: int
    start_date: date
    end_date: date
    total_qty: int = Field(..., ge=0)
    settlement_price: Optional[float] = None
    weekdays: Optional[List[int]] = None

