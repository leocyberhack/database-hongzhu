from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    """审计日志读取schema"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    table_name: str
    record_id: int
    operation: str
    diff_data: Optional[dict[str, Any]] = None
    operator: Optional[str] = None
    operated_at: datetime
    source: Optional[str] = None
