from datetime import datetime
from app.utils.time import now_china
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import select, func

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import Approval, AuditLog, Channel, Order, Sku, SkuChannel
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

    target_status = "approved" if payload.approve else "rejected"
    decided_at = now_china()
    comment = payload.comment or ""

    # Execute business logic first to avoid approving invalid operations
    if target_status == "approved" and approval.object_type != "price":
        if approval.object_type == "sku" and approval.action_type == "update":
            sku = await db.get(Sku, approval.object_id)
            if not sku:
                raise HTTPException(status_code=404, detail="SKU not found")
            after_data = approval.after_data or {}

            # Re-check sku_name uniqueness within bound channels
            new_name = after_data.get("sku_name")
            if new_name and new_name != sku.sku_name:
                channel_rows = await db.scalars(
                    select(SkuChannel.channel_id).where(SkuChannel.sku_id == sku.id)
                )
                channel_ids = list({cid for cid in channel_rows if cid is not None})
                if channel_ids:
                    conflict = await db.scalar(
                        select(Sku.id)
                        .join(SkuChannel)
                        .where(
                            SkuChannel.channel_id.in_(channel_ids),
                            Sku.sku_name == new_name,
                            Sku.id != sku.id,
                        )
                        .limit(1)
                    )
                    if conflict:
                        raise HTTPException(status_code=400, detail="SKU name already exists on this channel")

            for k, v in after_data.items():
                setattr(sku, k, v)

            exec_audit = AuditLog(
                table_name="sku",
                record_id=sku.id,
                operation="UPDATE",
                diff_data={"before": approval.before_data, "after": approval.after_data},
                operator=user.username,
                operated_at=now_china(),
                source="approval_execution",
            )
            db.add(exec_audit)

        elif approval.object_type == "channel":
            if approval.action_type == "create":
                payload_data = approval.after_data or {}
                channel_name = payload_data.get("channel_name")
                if not channel_name:
                    raise HTTPException(status_code=400, detail="Channel name is required")
                dup = await db.scalar(select(Channel.id).where(Channel.channel_name == channel_name))
                if dup:
                    raise HTTPException(status_code=400, detail="Channel name already exists")

                new_channel = Channel(**payload_data)
                db.add(new_channel)
                await db.flush()

                exec_audit = AuditLog(
                    table_name="channel",
                    record_id=new_channel.id,
                    operation="CREATE",
                    diff_data=payload_data,
                    operator=user.username,
                    operated_at=now_china(),
                    source="approval_execution",
                )
                db.add(exec_audit)

            elif approval.action_type == "update":
                chan = await db.get(Channel, approval.object_id)
                if not chan:
                    raise HTTPException(status_code=404, detail="Channel not found")
                after_data = approval.after_data or {}

                new_name = after_data.get("channel_name")
                if new_name and new_name != chan.channel_name:
                    dup = await db.scalar(
                        select(Channel.id).where(Channel.channel_name == new_name, Channel.id != chan.id)
                    )
                    if dup:
                        raise HTTPException(status_code=400, detail="Channel name already exists")

                for k, v in after_data.items():
                    setattr(chan, k, v)

                exec_audit = AuditLog(
                    table_name="channel",
                    record_id=chan.id,
                    operation="UPDATE",
                    diff_data={"before": approval.before_data, "after": approval.after_data},
                    operator=user.username,
                    operated_at=now_china(),
                    source="approval_execution",
                )
                db.add(exec_audit)

            elif approval.action_type == "delete":
                chan = await db.get(Channel, approval.object_id)
                if not chan:
                    raise HTTPException(status_code=404, detail="Channel not found")

                sub_count = await db.scalar(select(func.count()).where(Channel.parent_id == chan.id))
                if sub_count and sub_count > 0:
                    raise HTTPException(status_code=400, detail="Cannot delete channel with sub-channels")

                order_count = await db.scalar(
                    select(func.count()).select_from(Order).where(Order.channel_id == chan.id)
                )
                if order_count and order_count > 0:
                    raise HTTPException(status_code=400, detail=f"Cannot delete channel with orders: {order_count}")

                await db.delete(chan)

                exec_audit = AuditLog(
                    table_name="channel",
                    record_id=approval.object_id,
                    operation="DELETE",
                    diff_data=approval.before_data,
                    operator=user.username,
                    operated_at=now_china(),
                    source="approval_execution",
                )
                db.add(exec_audit)

    # Construct Chinese description
    approval.status = target_status
    approval.decided_at = decided_at
    approval.comment = comment

    action_cn = "批准" if target_status == "approved" else "驳回"
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
            "result": "已批准" if target_status == "approved" else "已驳回",
            "comment": comment
        },
        operator=user.username,
        operated_at=now_china(),
        source="approval_decision",
    )
    db.add_all([approval, audit])

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

