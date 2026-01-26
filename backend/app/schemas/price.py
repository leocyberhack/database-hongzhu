from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMBase


class ChannelBase(BaseModel):
    channel_name: str
    channel_type: Optional[str] = None
    parent_id: Optional[int] = None
    attrs: Optional[dict] = None
    status: Optional[str] = None


class ChannelCreate(ChannelBase):
    pass


class ChannelRead(ChannelBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None


class PriceBase(BaseModel):
    sku_id: int
    channel_id: int
    sale_price: float = Field(..., gt=0)
    cost_price: Optional[float] = None
    start_at: date
    end_at: date
    status: Optional[str] = None
    created_by: Optional[str] = None


class PriceCreate(PriceBase):
    pass


class PriceRead(PriceBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None


class PriceDecision(BaseModel):
    approve: bool
    comment: Optional[str] = None


class PriceHistoryRead(ORMBase):
    id: int
    price_id: int
    before_data: Optional[dict] = None
    after_data: Optional[dict] = None
    operator: Optional[str] = None
    operated_at: datetime
    approval_id: Optional[int] = None
