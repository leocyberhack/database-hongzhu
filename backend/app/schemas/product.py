from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel

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


class ProductBase(BaseModel):
    product_name: str
    description: Optional[str] = None
    status: Optional[str] = None
    structure_hash: str
    created_by: Optional[str] = None
    category_id: Optional[int] = None
    suggested_price: Optional[float] = None
    poi_id: Optional[int] = None


class ProductCreate(ProductBase):
    resources: list[ProductResourceLine]


class ProductRead(ProductBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProductCategoryCreate(BaseModel):
    name: str
    status: str = "active"
    description: Optional[str] = None


class ProductCategoryRead(ProductCategoryCreate, ORMBase):
    id: int
    created_at: Optional[datetime] = None


class ProductSnapshotRead(ORMBase):
    id: int
    product_id: int
    snapshot_data: dict
    created_at: datetime




