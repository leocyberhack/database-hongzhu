from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.common import ORMBase


class ApprovalRead(ORMBase):
    id: int
    object_type: str
    object_id: int
    action_type: str
    before_data: Optional[dict] = None
    after_data: Optional[dict] = None
    status: str
    applicant: str
    approver: str
    applied_at: datetime
    decided_at: Optional[datetime] = None
    comment: Optional[str] = None


class ApprovalDecision(BaseModel):
    approve: bool
    comment: Optional[str] = None
