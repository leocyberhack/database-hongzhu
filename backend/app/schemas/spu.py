from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.common import Pagination, ORMBase

class SpuBase(BaseModel):
    name: str
    spu_code: Optional[str] = None
    category: Optional[str] = None
    remark: Optional[str] = None

class SpuCreate(SpuBase):
    pass

class SpuUpdate(BaseModel):
    name: Optional[str] = None
    spu_code: Optional[str] = None
    category: Optional[str] = None
    remark: Optional[str] = None

class SpuResponse(SpuBase):
    id: int
    created_at: datetime
    updated_at: datetime
    sku_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class SpuListResponse(BaseModel):
    items: List[SpuResponse]
    pagination: Pagination
