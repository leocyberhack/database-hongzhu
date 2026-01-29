from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.common import Pagination

class SkuBase(BaseModel):
    product_id: int
    spu_id: int
    sku_name: str
    sku_type: Optional[str] = None
    sale_start: Optional[date] = None
    sale_end: Optional[date] = None
    travel_start: Optional[date] = None
    travel_end: Optional[date] = None
    poi_id: Optional[int] = None
    status: str = "draft"

class SkuCreate(SkuBase):
    pass

class SkuUpdate(BaseModel):
    sku_name: Optional[str] = None
    spu_id: Optional[int] = None
    sku_type: Optional[str] = None
    sale_start: Optional[date] = None
    sale_end: Optional[date] = None
    travel_start: Optional[date] = None
    travel_end: Optional[date] = None
    poi_id: Optional[int] = None
    status: Optional[str] = None
    # product_id is generally immutable after creation, or requires careful handling

class SkuResponse(SkuBase):
    id: int
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    # Optional: include simple product info if needed, but for now keep it simple
    # product_name: Optional[str] = None 

    model_config = ConfigDict(from_attributes=True)

class SkuListResponse(BaseModel):
    items: List[SkuResponse]
    pagination: Pagination
