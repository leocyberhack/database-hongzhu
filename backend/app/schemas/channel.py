from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.common import Pagination

class ChannelBase(BaseModel):
    channel_name: str
    channel_type: Optional[str] = None
    parent_id: Optional[int] = None
    attrs: Optional[dict] = None
    status: str = "active"

class ChannelCreate(ChannelBase):
    pass

class ChannelUpdate(BaseModel):
    channel_name: Optional[str] = None
    channel_type: Optional[str] = None
    parent_id: Optional[int] = None
    attrs: Optional[dict] = None
    status: Optional[str] = None

class ChannelResponse(ChannelBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChannelListResponse(BaseModel):
    items: List[ChannelResponse]
    pagination: Pagination
