from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.common import ORMBase



class ProductResourceLine(BaseModel):
    resource_id: int
    supplier_id: Optional[int] = None
    quantity: int
    required_flag: bool = True
    remark: Optional[str] = None


class ProductResourceRead(ORMBase):
    id: int
    product_id: int
    resource_id: int
    supplier_id: Optional[int] = None
    quantity: int
    required_flag: bool
    remark: Optional[str] = None


# Channel allocation with stock ratio
class ChannelAllocation(BaseModel):
    channel_id: int
    stock_ratio: float = 0  # Percentage (0-100), default 0 means not allocated


class ProductBase(BaseModel):
    product_name: str
    description: Optional[str] = None
    status: Optional[str] = None
    structure_hash: str
    created_by: Optional[str] = None
    category_id: Optional[int] = None
    suggested_price: Optional[float] = None
    base_cost: Optional[float] = None
    poi_id: Optional[int] = None
    allowed_channels: Optional[list[ChannelAllocation]] = None  # Changed to list of allocations

    @field_validator("allowed_channels", mode="before")
    @classmethod
    def normalize_allowed_channels(cls, value):
        if value is None:
            return value
        if not isinstance(value, list):
            return value
        normalized = []
        for item in value:
            if isinstance(item, dict):
                if "channel_id" not in item:
                    continue
                if item.get("stock_ratio") is None:
                    item = {**item, "stock_ratio": 100}
                normalized.append(item)
                continue
            try:
                channel_id = int(item)
            except (TypeError, ValueError):
                continue
            normalized.append({"channel_id": channel_id, "stock_ratio": 100})
        return normalized


class ProductCreate(ProductBase):
    resources: list[ProductResourceLine]


class ProductRead(ProductBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProductCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProductCategoryRead(ProductCategoryCreate, ORMBase):
    id: int
    created_at: Optional[datetime] = None


class ProductSnapshotRead(ORMBase):
    id: int
    product_id: int
    snapshot_data: dict
    created_at: datetime



