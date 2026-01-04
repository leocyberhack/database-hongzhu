from typing import Optional, List

from pydantic import BaseModel


class ReportPoint(BaseModel):
    period: str
    gmv: float
    profit: float
    orders: int
    verified: int
    refunded: int


class TopItem(BaseModel):
    key: str
    gmv: float
    profit: float
    orders: int


class ReportResponse(BaseModel):
    trend: List[ReportPoint]
    top_channel: List[TopItem]
    top_sku: List[TopItem]
    top_product: List[TopItem]
