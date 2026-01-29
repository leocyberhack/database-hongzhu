from typing import List, Optional, Literal
from pydantic import BaseModel

class ProductPreviewItem(BaseModel):
    """库存预览项目"""
    resource_id: int
    supplier_mode: Literal['auto', 'locked'] = 'auto'
    supplier_ids: Optional[List[int]] = None  # 锁定模式下的供应商ID列表
    quantity: int

class ProductInventoryPreviewRequest(BaseModel):
    resources: List[ProductPreviewItem]
    start_date: Optional[str] = None
    end_date: Optional[str] = None

