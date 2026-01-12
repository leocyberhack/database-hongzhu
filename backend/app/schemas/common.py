from datetime import datetime, date
from typing import Optional, Any

from pydantic import BaseModel, Field

# Import resource type-specific attrs schemas for reference
# These define the structure of the 'attrs' JSONB field for different resource types
from app.schemas.resource_attrs import TicketAttrs, HotelAttrs, GenericAttrs


class ORMBase(BaseModel):
    class Config:
        from_attributes = True


class Pagination(BaseModel):
    total: int
    page: int
    page_size: int


class ListResponse(BaseModel):
    items: list[Any]
    pagination: Pagination


class PoiBase(BaseModel):
    poi_name: str
    city: str
    poi_type: Optional[str] = None
    address: Optional[str] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = None


class PoiCreate(PoiBase):
    pass


class PoiUpdate(BaseModel):
    poi_name: Optional[str] = None
    city: Optional[str] = None
    poi_type: Optional[str] = None
    address: Optional[str] = None
    tags: Optional[list[str]] = None
    status: Optional[str] = None


class PoiRead(PoiBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ResourceBase(BaseModel):
    poi_id: int
    resource_name: str
    resource_type: str
    # attrs should follow the schema of the corresponding resource_type:
    # - "门票" -> TicketAttrs
    # - "酒店" -> HotelAttrs
    # - others -> GenericAttrs or custom dict
    attrs: Optional[dict] = Field(None, description="Resource type-specific attributes (JSONB)")
    status: Optional[str] = None


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    poi_id: Optional[int] = None
    resource_name: Optional[str] = None
    resource_type: Optional[str] = None
    attrs: Optional[dict] = None
    status: Optional[str] = None


class ResourceRead(ResourceBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SupplierBase(BaseModel):
    supplier_name: str
    contact_info: Optional[dict] = None
    settlement_info: Optional[dict] = None
    qualification_files: Optional[list[dict]] = None
    tags: Optional[list[str]] = None
    remark: Optional[str] = None


class SupplierCreate(SupplierBase):
    pass


class SupplierRead(SupplierBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SupplierResourceBase(BaseModel):
    supplier_id: int
    resource_id: int
    supply_status: Optional[str] = None
    settlement_price: Optional[float] = None
    currency: Optional[str] = None
    rule: Optional[dict] = None
    priority: Optional[int] = 1


class SupplierResourceCreate(SupplierResourceBase):
    pass


class SupplierResourceRead(SupplierResourceBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SupplierResourceAdjust(BaseModel):
    settlement_price: float
    reason: Optional[str] = None


class SupplierResourcePriceHistoryRead(ORMBase):
    id: int
    supplier_resource_id: int
    before_price: Optional[float] = None
    after_price: Optional[float] = None
    reason: Optional[str] = None
    operator: Optional[str] = None
    operated_at: Optional[datetime] = None
    approval_id: Optional[int] = None
