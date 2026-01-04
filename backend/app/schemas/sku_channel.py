from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.common import Pagination

class SkuChannelBase(BaseModel):
    sku_id: int
    channel_id: int
    channel_sku_code: Optional[str] = None
    status: str = "active"

class SkuChannelCreate(SkuChannelBase):
    pass

class SkuChannelUpdate(BaseModel):
    channel_sku_code: Optional[str] = None
    status: Optional[str] = None

class SkuChannelResponse(SkuChannelBase):
    id: int
    created_at: datetime
    
    # We might want to inject names for easier frontend display
    channel_name: Optional[str] = None
    sku_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class SkuChannelListResponse(BaseModel):
    items: List[SkuChannelResponse]
    pagination: Pagination
