from datetime import datetime
from app.utils.time import now_china
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import AuditLog, Product, Sku, Approval, SkuChannel, Spu
from app.schemas.common import Pagination
from app.schemas.sku import SkuCreate, SkuListResponse, SkuResponse, SkuUpdate

router = APIRouter()


async def _get_sku_channel_ids(db: DbSession, sku_id: int) -> list[int]:
    rows = await db.scalars(select(SkuChannel.channel_id).where(SkuChannel.sku_id == sku_id))
    return list({cid for cid in rows if cid is not None})


async def _has_channel_name_conflict(db: DbSession, sku_id: int, sku_name: str, channel_ids: list[int]) -> bool:
    if not channel_ids:
        return False
    stmt = (
        select(Sku.id)
        .join(SkuChannel)
        .where(
            SkuChannel.channel_id.in_(channel_ids),
            Sku.sku_name == sku_name,
            Sku.id != sku_id,
        )
        .limit(1)
    )
    return await db.scalar(stmt) is not None


@router.post("/batch-delete", status_code=204)
async def batch_delete_skus(
    ids: list[int],
    db: DbSession,
    _: User = Depends(get_current_user),
):
    if not ids:
        return
        
    stmt = select(Sku).where(Sku.id.in_(ids))
    skus = await db.scalars(stmt)
    
    for sku in skus:
        await db.delete(sku)
        
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Batch delete failed")


@router.post("/batch-update", status_code=200)
async def batch_update_skus(
    payload: dict,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    ids = payload.get("ids", [])
    fields = payload.get("fields", {})
    
    if not ids or not fields:
        raise HTTPException(status_code=400, detail="Missing IDs or fields")

    # Validate fields
    try:
        update_data = SkuUpdate(**fields).model_dump(exclude_unset=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid update fields: {str(e)}")

    ids = list(dict.fromkeys(ids))
    stmt = select(Sku).where(Sku.id.in_(ids))
    skus = list(await db.scalars(stmt))
    if len(skus) != len(ids):
        found_ids = {sku.id for sku in skus}
        missing = [sid for sid in ids if sid not in found_ids]
        raise HTTPException(status_code=404, detail=f"SKU not found: {missing}")

    if not skus:
        return {"updated": 0, "pending": 0, "skipped": 0, "errors": []}

    # Validate sku_name uniqueness across channels if sku_name is being updated
    if "sku_name" in update_data and update_data["sku_name"]:
        new_name = update_data["sku_name"]
        affected_skus = [sku for sku in skus if sku.sku_name != new_name]
        if affected_skus:
            affected_ids = [sku.id for sku in affected_skus]
            # Preload channels for affected SKUs
            bindings = await db.execute(
                select(SkuChannel.sku_id, SkuChannel.channel_id).where(SkuChannel.sku_id.in_(affected_ids))
            )
            channel_map: dict[int, set[int]] = {}
            for sku_id, channel_id in bindings.all():
                if channel_id is None:
                    continue
                channel_map.setdefault(sku_id, set()).add(channel_id)

            # Check conflicts among the batch itself (same name on same channel)
            channel_name_map: dict[tuple[int, str], list[int]] = {}
            for sku in affected_skus:
                channels = channel_map.get(sku.id, set())
                for cid in channels:
                    channel_name_map.setdefault((cid, new_name), []).append(sku.id)
            for (cid, _), sku_ids in channel_name_map.items():
                if len(sku_ids) > 1:
                    raise HTTPException(
                        status_code=400,
                        detail=f"SKU名称在同渠道下必须唯一，渠道 {cid} 存在重复 SKU",
                    )

            # Check conflicts against existing SKUs on those channels
            for sku in affected_skus:
                channels = list(channel_map.get(sku.id, set()))
                if await _has_channel_name_conflict(db, sku.id, new_name, channels):
                    raise HTTPException(status_code=400, detail="SKU name already exists on this channel")

    changed_items: list[tuple[Sku, dict]] = []
    skipped_count = 0
    for sku in skus:
        changes = {k: v for k, v in update_data.items() if getattr(sku, k) != v}
        if not changes:
            skipped_count += 1
            continue
        changed_items.append((sku, changes))

    if not changed_items:
        return {"updated": 0, "pending": 0, "skipped": skipped_count, "errors": []}

    approval_flags = set()
    if user.role not in ["admin", "super_admin"]:
        for sku, changes in changed_items:
            needs_approval = False
            if "status" in changes and changes["status"] != sku.status:
                needs_approval = True
            if sku.status == "active":
                if any(k for k in changes if k != "status"):
                    needs_approval = True
            approval_flags.add(needs_approval)
    else:
        approval_flags.add(False)

    if len(approval_flags) > 1:
        raise HTTPException(
            status_code=400,
            detail="批量操作包含需审批与无需审批的SKU，请拆分后再提交",
        )

    updated_count = 0
    pending_count = 0
    needs_approval_all = approval_flags.pop()

    if needs_approval_all:
        for sku, _ in changed_items:
            approval = Approval(
                object_type="sku",
                object_id=sku.id,
                action_type="update",
                before_data={"sku_name": sku.sku_name, "status": sku.status, "product_id": sku.product_id},
                after_data=update_data,
                status="pending",
                applicant=user.username,
                approver="admin",
                applied_at=now_china(),
            )
            db.add(approval)
            pending_count += 1
    else:
        for sku, changes in changed_items:
            before_data = {"sku_name": sku.sku_name, "status": sku.status, "product_id": sku.product_id}
            for k, v in changes.items():
                setattr(sku, k, v)

            audit = AuditLog(
                table_name="sku",
                record_id=sku.id,
                operation="UPDATE",
                diff_data={"before": before_data, "after": changes},
                operator=user.username,
                operated_at=now_china(),
                source="web",
            )
            db.add(audit)
            updated_count += 1

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Batch update failed")

    return {
        "updated": updated_count,
        "pending": pending_count,
        "skipped": skipped_count,
        "errors": [],
    }


@router.post("", response_model=SkuResponse, status_code=201)
async def create_sku(
    payload: SkuCreate,
    db: DbSession,
    current_user: User = Depends(get_current_user),
):
    # Verify Product exists
    product = await db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {payload.product_id} not found")

    # Verify SPU exists
    spu = await db.get(Spu, payload.spu_id)
    if not spu:
        raise HTTPException(status_code=404, detail=f"SPU with id {payload.spu_id} not found")
        
    # Logic Lock 3: Inactive products cannot be associated with SKUs
    if product.status != "active":
         raise HTTPException(status_code=400, detail="Cannot create SKU for inactive product")

    sku = Sku(**payload.model_dump())
    sku.created_by = current_user.username  # Record creator
    sku.poi_id = product.poi_id # Auto-inherit POI from product

    db.add(sku)
    try:
        await db.flush()
        
        # Record audit log
        audit = AuditLog(
            table_name="sku",
            record_id=sku.id,
            operation="CREATE",
            diff_data={"sku_name": sku.sku_name, "product_id": sku.product_id, "status": sku.status},
            operator=current_user.username,
            operated_at=now_china(),
            source="web",
        )
        db.add(audit)
        
        await db.commit()
        await db.refresh(sku)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="SKU creation failed")
    
    return sku


@router.get("", response_model=SkuListResponse)
async def list_skus(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    product_id: Optional[int] = Query(default=None, description="Filter by product ID"),
    spu_id: Optional[int] = Query(default=None, description="Filter by SPU ID"),
    keyword: Optional[str] = Query(default=None, description="Search by sku name"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    poi_id: Optional[int] = Query(default=None, description="Filter by POI ID"),
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
):
    stmt = select(Sku)
    
    if product_id is not None:
        stmt = stmt.where(Sku.product_id == product_id)
    if spu_id is not None:
        stmt = stmt.where(Sku.spu_id == spu_id)
    if keyword:
        stmt = stmt.where(Sku.sku_name.ilike(f"%{keyword}%"))
    if status:
        stmt = stmt.where(Sku.status == status)
    if poi_id is not None:
        stmt = stmt.where(Sku.poi_id == poi_id)
    
    # Sorting logic
    if sort_field and hasattr(Sku, sort_field):
        field = getattr(Sku, sort_field)
        if sort_order == "descend":
            stmt = stmt.order_by(field.desc())
        else:
            stmt = stmt.order_by(field.asc())
            
        # Special case: if sorting by sku_name, add secondary sort by poi_id
        if sort_field == "sku_name":
            stmt = stmt.order_by(Sku.poi_id.asc())
    else:
        # Default: Aggregate by POI (Cluster by POI)
        stmt = stmt.order_by(Sku.poi_id.asc(), Sku.id.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))

    return SkuListResponse(
        items=[row for row in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.get("/{sku_id}", response_model=SkuResponse)
async def get_sku(
    sku_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    sku = await db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    return sku


@router.patch("/{sku_id}", response_model=SkuResponse)
async def update_sku(
    sku_id: int,
    payload: SkuUpdate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "operator", "product"])),
):
    sku = await db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")

    # Capture before state
    before_data = {"sku_name": sku.sku_name, "status": sku.status, "product_id": sku.product_id}
    update_data = payload.model_dump(exclude_unset=True)

    # Enforce sku_name uniqueness within bound channels
    if "sku_name" in update_data and update_data["sku_name"] and update_data["sku_name"] != sku.sku_name:
        channel_ids = await _get_sku_channel_ids(db, sku_id)
        if await _has_channel_name_conflict(db, sku_id, update_data["sku_name"], channel_ids):
            raise HTTPException(status_code=400, detail="SKU name already exists on this channel")

    # Check for approval requirement
    needs_approval = False
    if user.role not in ["admin", "super_admin"]:
        # Rule 1: Status change requires approval
        if "status" in update_data and update_data["status"] != sku.status:
            needs_approval = True
        
        # Rule 2: Info/Price change for ACTIVE/ONLINE SKU requires approval
        # (Assuming 'active' is the status for online)
        if sku.status == "active":
             # If there are changes other than status
             if any(k for k in update_data if k != "status"):
                 needs_approval = True

    if needs_approval:
        # Create Approval request instead of updating
        approval = Approval(
            object_type="sku",
            object_id=sku.id,
            action_type="update",
            before_data=before_data,
            after_data=update_data,
            status="pending",
            applicant=user.username,
            approver="admin",
            applied_at=now_china(),
        )
        db.add(approval)
        await db.commit()
        await db.refresh(approval)
        # Return current SKU state (modification pending)
        return sku

    for k, v in update_data.items():
        setattr(sku, k, v)

    try:
        # Record audit log
        audit = AuditLog(
            table_name="sku",
            record_id=sku.id,
            operation="UPDATE",
            diff_data={"before": before_data, "after": update_data},
            operator=user.username,
            operated_at=now_china(),
            source="web",
        )
        db.add(audit)
        
        await db.commit()
        await db.refresh(sku)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Update failed")
    
    return sku


@router.delete("/{sku_id}", status_code=204)
async def delete_sku(
    sku_id: int,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    sku = await db.get(Sku, sku_id)
    if not sku:
        raise HTTPException(status_code=404, detail="SKU not found")
    
    # In a real system, you might want to check for dependencies (orders, price, inventory)
    # For now, we rely on DB foreign key constraints (ON DELETE RESTRICT is common for sensitive data)
    
    try:
        # Record audit log before deletion
        audit = AuditLog(
            table_name="sku",
            record_id=sku.id,
            operation="DELETE",
            diff_data={"sku_name": sku.sku_name, "product_id": sku.product_id},
            operator=user.username,
            operated_at=now_china(),
            source="web",
        )
        db.add(audit)
        
        await db.delete(sku)
        await db.commit()
    except IntegrityError:
         await db.rollback()
         raise HTTPException(status_code=400, detail="Cannot delete SKU, it might be referenced by other records")
    
    return None
