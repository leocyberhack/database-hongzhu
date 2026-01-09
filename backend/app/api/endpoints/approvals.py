from datetime import datetime
from app.utils.time import now_china
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
    user: User = Depends(require_roles(["admin", "product"])),
):
    approval = await db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "pending":
        raise HTTPException(status_code=400, detail="Approval already processed")

    approval.status = "approved" if payload.approve else "rejected"
    approval.decided_at = now_china()
    approval.comment = payload.comment or ""

    # Construct Chinese description
    action_cn = "批准" if payload.approve else "驳回"
    obj_cn_map = {"sku": "SKU", "channel": "渠道", "price": "价格"}
    op_cn_map = {"create": "新建", "update": "修改", "delete": "删除"}
    
    obj_text = obj_cn_map.get(approval.object_type, approval.object_type)
    op_text = op_cn_map.get(approval.action_type, approval.action_type)
    
    description = f"{action_cn}了 {obj_text} {op_text} 申请"

    audit = AuditLog(
        table_name="approval",
        record_id=approval.id,
        operation="审批决定",
        diff_data={
            "description": description,
            "result": "已批准" if payload.approve else "已驳回",
            "comment": approval.comment
        },
        operator=user.username,
        operated_at=now_china(),
        source="approval_decision",
    )
    db.add_all([approval, audit])

    # Price approval status is handled via /prices/{id}/decision; update other types here.
    if approval.object_type != "price":
        await db.execute(
            update(Approval)
            .where(Approval.id == approval.id)
            .values(status=approval.status, decided_at=approval.decided_at, comment=approval.comment)
        )
        
        # Execute business logic if approved
        if approval.status == "approved":
            from app.models import Sku, Channel
            
            if approval.object_type == "sku":
                if approval.action_type == "update":
                    stmt = select(Sku).where(Sku.id == approval.object_id)
                    sku = await db.scalar(stmt)
                    if sku:
                        for k, v in approval.after_data.items():
                            setattr(sku, k, v)
                        
                        # Record secondary audit log for the actual execution
                        exec_audit = AuditLog(
                            table_name="sku",
                            record_id=sku.id,
                            operation="UPDATE",
                            diff_data={"before": approval.before_data, "after": approval.after_data},
                            operator=user.username,
                            operated_at=now_china(),
                            source="approval_execution"
                        )
                        db.add(exec_audit)

            elif approval.object_type == "channel":
                if approval.action_type == "create":
                    # For creation, object_id might be 0 or null, data is in after_data
                    payload = approval.after_data
                    new_channel = Channel(**payload)
                    db.add(new_channel)
                    await db.flush() # get ID
                    
                    # Update approval record with the new ID for reference? Optional.
                    
                    exec_audit = AuditLog(
                        table_name="channel",
                        record_id=new_channel.id,
                        operation="CREATE",
                        diff_data=payload,
                        operator=user.username,
                        operated_at=now_china(),
                        source="approval_execution"
                    )
                    db.add(exec_audit)
                    
                elif approval.action_type == "update":
                    stmt = select(Channel).where(Channel.id == approval.object_id)
                    chan = await db.scalar(stmt)
                    if chan:
                        for k, v in approval.after_data.items():
                            setattr(chan, k, v)
                            
                        exec_audit = AuditLog(
                            table_name="channel",
                            record_id=chan.id,
                            operation="UPDATE",
                            diff_data={"before": approval.before_data, "after": approval.after_data},
                            operator=user.username,
                            operated_at=now_china(),
                            source="approval_execution"
                        )
                        db.add(exec_audit)
                        
                elif approval.action_type == "delete":
                    stmt = select(Channel).where(Channel.id == approval.object_id)
                    chan = await db.scalar(stmt)
                    if chan:
                        db.delete(chan)
                        
                        exec_audit = AuditLog(
                            table_name="channel",
                            record_id=approval.object_id,
                            operation="DELETE",
                            diff_data=approval.before_data,
                            operator=user.username,
                            operated_at=now_china(),
                            source="approval_execution"
                        )
                        db.add(exec_audit)

    await db.commit()
    await db.refresh(approval)
    return ApprovalRead.model_validate(approval)


@router.post("/approvals/batch-delete", status_code=204)
async def batch_delete_approvals(
    payload: dict,
    db: DbSession,
    user: User = Depends(require_roles(["super_admin"])),
):
    ids = payload.get("ids", [])
    if not ids:
        return

    # Only allow deleting processed approvals (approved/rejected), NOT pending ones ideally
    # But user asked for delete capability, assuming cleanup purposes.
    # Safe guard: maybe only delete finished ones? 
    # User request "delete approval records", implied utility for cleanup.
    
    # Let's delete them.
    stmt = select(Approval).where(Approval.id.in_(ids))
    rows = await db.scalars(stmt)
    
    count = 0
    for row in rows:
        await db.delete(row)
        count += 1
    
    await db.commit()
    return None

