from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMBase


class OrderCreate(BaseModel):
    order_no: str
    channel_id: int
    sku_id: int
    product_id: int
    travel_date: date
    quantity: int = Field(..., gt=0)
    sale_price: float
    cost_price: Optional[float] = None
    remark: Optional[str] = None
    # Manual supplier selection: {resource_id: supplier_id}
    resource_selections: Optional[dict[int, int]] = None


class OrderRead(ORMBase):
    id: int
    order_no: str
    channel_id: int
    sku_id: int
    product_id: int
    travel_date: date
    quantity: int
    sale_price: float
    sale_amount: float
    cost_price: Optional[float] = None
    cost_amount: Optional[float] = None
    profit_amount: Optional[float] = None
    status: str
    created_by: Optional[str] = None
    created_at: datetime
    verified_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    remark: Optional[str] = None


class OrderDecision(BaseModel):
    action: str  # verify | refund
    comment: Optional[str] = None


class OrderStatusHistoryRead(ORMBase):
    id: int
    order_id: int
    before_status: Optional[str] = None
    after_status: str
    operator: Optional[str] = None
    operated_at: datetime
    reason: Optional[str] = None
