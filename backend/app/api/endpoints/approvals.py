from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import select, func, update

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import Approval, AuditLog
from app.schemas.approval import ApprovalDecision, ApprovalRead
from app.schemas.common import ListResponse, Pagination

router = APIRouter()


@router.get("/approvals", response_model=ListResponse)
async def list_approvals(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=1000),
    status: Optional[str] = Query(default=None),
    object_type: Optional[str] = Query(default=None),
    approver: Optional[str] = Query(default=None),
):
    stmt = select(Approval)
    if status:
        stmt = stmt.where(Approval.status == status)
    if object_type:
        stmt = stmt.where(Approval.object_type == object_type)
    if approver:
        stmt = stmt.where(Approval.approver == approver)

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(Approval.applied_at.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[ApprovalRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/approvals/{approval_id}/decision", response_model=ApprovalRead)
async def decide_approval(
    payload: ApprovalDecision,
    db: DbSession,
    approval_id: int = Path(..., ge=1),
    user: User = Depends(require_roles(["manager"])),
):
    approval = await db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="瀹℃壒涓嶅瓨鍦?)
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail="瀹℃壒宸插鐞?)

    approval.status = "approved" if payload.approve else "rejected"
    approval.decided_at = datetime.utcnow()
    approval.comment = payload.comment or ""

    audit = AuditLog(
        table_name="approval",
        record_id=approval.id,
        operation="DECISION",
        diff_data={"status": approval.status, "comment": approval.comment},
        operator=user.username,
        operated_at=datetime.utcnow(),
        source="approval_decision",
    )
    db.add_all([approval, audit])

    # 瀵?Price 鐨勫鎵瑰凡缁忕敱 /prices/{id}/decision 鎵ц鐢熸晥閫昏緫锛涜繖閲屼粎鏇存柊鍏朵粬绫诲瀷鐨勫鎵圭姸鎬併€?    if approval.object_type != "price":
        await db.execute(
            update(Approval)
            .where(Approval.id == approval.id)
            .values(status=approval.status, decided_at=approval.decided_at, comment=approval.comment)
        )

    await db.commit()
    await db.refresh(approval)
    return ApprovalRead.model_validate(approval)
