from datetime import datetime, date
from typing import Optional, Any

from pydantic import BaseModel, Field, field_validator

# Import resource type-specific attrs schemas for reference
# These define the structure of the 'attrs' JSONB field for different resource types
from app.schemas.resource_attrs import TicketAttrs, HotelAttrs, DiningAttrs, TransportAttrs
# Import POI type-specific attrs schemas
from app.schemas.poi_attrs import TicketPoiAttrs, HotelPoiAttrs, DiningPoiAttrs, TransportPoiAttrs


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
    poi_type: str  # 必选：景区/酒店/餐饮/交通
    poi_code: Optional[str] = None
    province: Optional[str] = None
    city: str
    district: Optional[str] = None
    address: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    tags: Optional[list[str]] = None
    attrs: Optional[dict] = Field(None, description="POI类型的通用属性 (JSONB)")
    status: Optional[str] = None


class PoiCreate(PoiBase):
    province: str
    district: str


class PoiUpdate(BaseModel):
    poi_name: Optional[str] = None
    poi_type: Optional[str] = None  # 允许修改POI类型
    poi_code: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    tags: Optional[list[str]] = None
    attrs: Optional[dict] = None
    status: Optional[str] = None


class PoiRead(PoiBase, ORMBase):
    id: int
    folder_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ResourceBase(BaseModel):
    poi_id: int
    resource_name: str
    resource_code: Optional[str] = None
    resource_type: str
    # attrs should follow the schema of the corresponding resource_type:
    # - "景区" -> TicketAttrs
    # - "酒店" -> HotelAttrs
    # - others -> GenericAttrs or custom dict
    attrs: Optional[dict] = Field(None, description="Resource type-specific attributes (JSONB)")
    status: Optional[str] = None


class ResourceCreate(ResourceBase):
    pass


class ResourceUpdate(BaseModel):
    poi_id: Optional[int] = None
    resource_name: Optional[str] = None
    resource_code: Optional[str] = None
    resource_type: Optional[str] = None
    attrs: Optional[dict] = None
    status: Optional[str] = None


class ResourceRead(ResourceBase, ORMBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SupplierContact(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None


class SupplierBase(BaseModel):
    supplier_name: str
    contact_info: Optional[list[SupplierContact]] = None
    settlement_info: Optional[dict] = None
    qualification_files: Optional[list[dict]] = None
    tags: Optional[list[str]] = None
    remark: Optional[str] = None
    attrs: Optional[dict] = None
    contract_start_date: Optional[date] = None
    contract_end_date: Optional[date] = None

    @field_validator("contact_info", mode="before")
    @classmethod
    def normalize_contact_info(cls, value):
        if value is None:
            return None
        if isinstance(value, dict):
            return [
                {
                    "name": value.get("name") or value.get("contact_name"),
                    "phone": value.get("phone") or value.get("contact_phone"),
                    "email": value.get("email") or value.get("contact_email"),
                    "position": value.get("position"),
                }
            ]
        if isinstance(value, list):
            return value
        return value


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
