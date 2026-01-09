from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_serializer, field_validator
from app.schemas.common import Pagination

class ChannelBase(BaseModel):
    channel_name: str
    channel_type: Optional[str] = None
    commission_rate: Optional[float] = None
    parent_id: Optional[int] = None
    attrs: Optional[dict] = None

class ChannelCreate(ChannelBase):
    pass

class ChannelUpdate(BaseModel):
    channel_name: Optional[str] = None
    channel_type: Optional[str] = None
    commission_rate: Optional[float] = None
    parent_id: Optional[int] = None
    attrs: Optional[dict] = None

class ChannelResponse(ChannelBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
    
    @field_validator('commission_rate', mode='before')
    @classmethod
    def convert_decimal_to_float(cls, value):
        """Convert Decimal to float for JSON serialization"""
        if value is None:
            return None
        if isinstance(value, Decimal):
            return float(value)
        return value

class ChannelListResponse(BaseModel):
    items: List[ChannelResponse]
    pagination: Pagination
