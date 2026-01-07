from typing import List, Optional
from pydantic import BaseModel

class ProductPreviewItem(BaseModel):
    resource_id: int
    supplier_id: Optional[int] = None
    quantity: int

class ProductInventoryPreviewRequest(BaseModel):
    resources: List[ProductPreviewItem]
    start_date: Optional[str] = None
    end_date: Optional[str] = None
