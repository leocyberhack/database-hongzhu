from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, field_validator

from app.schemas.common import ORMBase



class ProductResourceLine(BaseModel):
    """产品资源行项目 - 用于创建/更新产品"""
    resource_id: int
    supplier_mode: Literal['auto', 'locked'] = 'auto'  # 'auto' 自动选择, 'locked' 锁定指定供应商
    supplier_ids: Optional[list[int]] = None  # 锁定模式下的供应商ID列表
    quantity: int
    required_flag: bool = True
    remark: Optional[str] = None
    
    @field_validator('supplier_ids', mode='before')
    @classmethod
    def validate_supplier_ids(cls, v, info):
        # 如果是锁定模式，supplier_ids 必须非空
        # 注意：这里的验证是宽松的，严格验证在 API 层做
        if v is None:
            return None
        if isinstance(v, list):
            return [int(x) for x in v if x is not None]
        return v


class ProductResourceRead(ORMBase):
    """产品资源行项目 - 用于读取"""
    id: int
    product_id: int
    resource_id: int
    supplier_mode: str = 'auto'
    supplier_ids: Optional[list[int]] = None
    quantity: int
    required_flag: bool
    remark: Optional[str] = None


# Channel allocation with stock ratio
class ChannelAllocation(BaseModel):
    channel_id: int
    stock_ratio: float = 0  # Percentage (0-100), default 0 means not allocated


class ProductBase(BaseModel):
    product_name: str
    product_code: Optional[str] = None  # 产品编码
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



