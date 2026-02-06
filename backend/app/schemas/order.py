from datetime import date, datetime
from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, Field


class OrderStatusFields(BaseModel):
    is_paid: bool = False
    paid_qty: Optional[int] = None
    paid_amount: Optional[float] = None
    paid_at: Optional[datetime] = None

    is_issued: bool = False
    issued_qty: Optional[int] = None
    issued_amount: Optional[float] = None
    issued_at: Optional[datetime] = None

    is_verified: bool = False
    verified_qty: Optional[int] = None
    verified_amount: Optional[float] = None
    verified_at: Optional[datetime] = None

    is_reserved: bool = False
    reserved_qty: Optional[int] = None
    reserved_amount: Optional[float] = None
    reserved_at: Optional[datetime] = None

    is_refund_unverified: bool = False
    refund_unverified_qty: Optional[int] = None
    refund_unverified_amount: Optional[float] = None
    refund_unverified_at: Optional[datetime] = None

    is_refund_unreserved: bool = False
    refund_unreserved_qty: Optional[int] = None
    refund_unreserved_amount: Optional[float] = None
    refund_unreserved_at: Optional[datetime] = None

    is_refund_verified: bool = False
    refund_verified_qty: Optional[int] = None
    refund_verified_amount: Optional[float] = None
    refund_verified_at: Optional[datetime] = None

    is_refund_reserved: bool = False
    refund_reserved_qty: Optional[int] = None
    refund_reserved_amount: Optional[float] = None
    refund_reserved_at: Optional[datetime] = None

    is_completed: bool = False
    completed_qty: Optional[int] = None
    completed_amount: Optional[float] = None
    completed_at: Optional[datetime] = None

    is_disputed: bool = False
    disputed_qty: Optional[int] = None
    disputed_amount: Optional[float] = None
    disputed_at: Optional[datetime] = None


class OrderResourceStatusFields(BaseModel):
    is_issued: bool = False
    issued_qty: Optional[int] = None
    issued_amount: Optional[float] = None
    issued_at: Optional[datetime] = None
    issued_remark: Optional[str] = None

    is_verified: bool = False
    verified_qty: Optional[int] = None
    verified_amount: Optional[float] = None
    verified_at: Optional[datetime] = None
    verified_remark: Optional[str] = None

    is_reserved: bool = False
    reserved_qty: Optional[int] = None
    reserved_amount: Optional[float] = None
    reserved_at: Optional[datetime] = None
    reserved_remark: Optional[str] = None

    is_refund_unverified: bool = False
    refund_unverified_qty: Optional[int] = None
    refund_unverified_amount: Optional[float] = None
    refund_unverified_at: Optional[datetime] = None
    refund_unverified_remark: Optional[str] = None

    is_refund_unreserved: bool = False
    refund_unreserved_qty: Optional[int] = None
    refund_unreserved_amount: Optional[float] = None
    refund_unreserved_at: Optional[datetime] = None
    refund_unreserved_remark: Optional[str] = None

    is_refund_verified: bool = False
    refund_verified_qty: Optional[int] = None
    refund_verified_amount: Optional[float] = None
    refund_verified_at: Optional[datetime] = None
    refund_verified_remark: Optional[str] = None

    is_refund_reserved: bool = False
    refund_reserved_qty: Optional[int] = None
    refund_reserved_amount: Optional[float] = None
    refund_reserved_at: Optional[datetime] = None
    refund_reserved_remark: Optional[str] = None

    is_completed: bool = False
    completed_qty: Optional[int] = None
    completed_amount: Optional[float] = None
    completed_at: Optional[datetime] = None
    completed_remark: Optional[str] = None

    is_disputed: bool = False
    disputed_qty: Optional[int] = None
    disputed_amount: Optional[float] = None
    disputed_at: Optional[datetime] = None
    disputed_remark: Optional[str] = None

    is_mid_disputed: bool = False
    mid_disputed_qty: Optional[int] = None
    mid_disputed_amount: Optional[float] = None
    mid_disputed_at: Optional[datetime] = None
    mid_disputed_remark: Optional[str] = None


class OrderResourceCreate(OrderResourceStatusFields):
    resource_id: int
    travel_date: date


class OrderCreate(OrderStatusFields):
    order_no: str
    channel_id: int
    sku_id: int
    product_id: Optional[int] = None
    is_paid: bool = True
    paid_at: datetime
    travel_date: Optional[date] = None
    quantity: int = Field(default=1, ge=1)
    sale_price: Optional[float] = Field(default=None, ge=0)
    cost_price: Optional[float] = Field(default=None, ge=0)
    remark: Optional[str] = None
    resource_selections: Optional[dict[int, int]] = None
    resource_items: Optional[list[OrderResourceCreate]] = None


class OrderRead(OrderStatusFields):
    id: int
    order_no: str
    channel_id: int
    sku_id: int
    product_id: int
    spu_id: Optional[int] = None
    travel_date: Optional[date] = None
    quantity: int
    sale_price: float
    sale_amount: float
    cost_price: Optional[float] = None
    cost_amount: Optional[float] = None
    profit_amount: Optional[float] = None
    remark: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None

    channel_name: Optional[str] = None
    spu_name: Optional[str] = None
    sku_name: Optional[str] = None
    product_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrderDecision(BaseModel):
    action: Literal[
        "issue",
        "verify",
        "unverify",
        "unissue",
        "refund",
        "refund_unverified",
        "refund_unreserved",
        "refund_verified",
        "refund_reserved",
    ]
    qty: Optional[int] = None
    amount: Optional[float] = None
    at: Optional[datetime] = None
    comment: Optional[str] = None


class OrderStatusHistoryRead(BaseModel):
    id: int
    order_id: int
    before_status: Optional[str] = None
    after_status: str
    operator: Optional[str] = None
    operated_at: Optional[datetime] = None
    reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
