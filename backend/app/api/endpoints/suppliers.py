from datetime import datetime
from app.utils.time import now_china
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import (
    AuditLog,
    Approval,
    Folder,
    Resource,
    Supplier,
    SupplierResource,
    SupplierResourcePriceHistory,
    ResourceInventory,
)
from app.schemas.common import (
    ListResponse,
    Pagination,
    SupplierCreate,
    SupplierRead,
    SupplierResourceAdjust,
    SupplierResourceCreate,
    SupplierResourceRead,
)
from app.schemas.inventory import (
    ResourceInventoryRead,
    ResourceInventoryBatchUpdate,
)

router = APIRouter()

SUPPLIER_ATTR_KEYS = (
    "supplier_code",
    "business_scope",
    "license_no",
    "legal_person",
    "credit_code",
)

REMOVED_SUPPLIER_ATTR_KEYS = {
    "settlement_cycle",
    "settlement_method",
    "invoice_info",
    "contract_no",
}


def _extract_supplier_attrs(attrs: Optional[dict], include_empty: bool = False) -> dict:
    attrs = attrs or {}
    data: dict = {}
    for key in SUPPLIER_ATTR_KEYS:
        value = attrs.get(key)
        if value is None or (isinstance(value, str) and not value.strip()):
            if include_empty:
                data[key] = None
            continue
        data[key] = value
    return data


def _sanitize_supplier_attrs(attrs: Optional[dict]) -> Optional[dict]:
    if not attrs:
        return attrs
    cleaned = {k: v for k, v in attrs.items() if k not in REMOVED_SUPPLIER_ATTR_KEYS}
    return cleaned or None


def _supplier_audit_snapshot(supplier: Supplier, include_empty_attrs: bool = False) -> dict:
    payload = {
        "supplier_name": supplier.supplier_name,
        "contact_info": supplier.contact_info,
        "folder_id": supplier.folder_id,
    }
    payload.update(_extract_supplier_attrs(supplier.attrs, include_empty=include_empty_attrs))
    return jsonable_encoder(payload)


@router.get("/suppliers", response_model=ListResponse)
async def list_suppliers(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    ids: Optional[list[int]] = Query(default=None),
    keyword: Optional[str] = Query(default=None, description="Search keyword"),
):
    stmt = select(Supplier)
    if ids:
        stmt = stmt.where(Supplier.id.in_(ids))
    if keyword:
        stmt = stmt.where(Supplier.supplier_name.ilike(f"%{keyword}%"))

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[SupplierRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/suppliers", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: SupplierCreate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    exists = await db.scalar(select(Supplier).where(Supplier.supplier_name == payload.supplier_name))
    if exists:
        raise HTTPException(status_code=400, detail="Supplier already exists")

    supplier_folder = Folder(
        name=f"SUPPLIER_{payload.supplier_name}",
        parent_id=None,
        created_by=user.username,
    )
    db.add(supplier_folder)
    await db.flush()

    payload_data = payload.model_dump()
    payload_data["attrs"] = _sanitize_supplier_attrs(payload_data.get("attrs"))
    obj = Supplier(**payload_data, folder_id=supplier_folder.id)
    db.add(obj)
    await db.flush()
    
    # Record audit log
    audit = AuditLog(
        table_name="supplier",
        record_id=obj.id,
        operation="CREATE",
        diff_data=_supplier_audit_snapshot(obj),
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(obj)
    return SupplierRead.model_validate(obj)


@router.post("/suppliers/{supplier_id}/folder", response_model=SupplierRead)
async def ensure_supplier_folder(
    supplier_id: int,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    if supplier.folder_id:
        return SupplierRead.model_validate(supplier)

    before_data = _supplier_audit_snapshot(supplier, include_empty_attrs=True)
    supplier_folder = Folder(
        name=f"SUPPLIER_{supplier.supplier_name}",
        parent_id=None,
        created_by=user.username,
    )
    db.add(supplier_folder)
    await db.flush()

    supplier.folder_id = supplier_folder.id
    db.add(supplier)

    audit = AuditLog(
        table_name="supplier",
        record_id=supplier.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": _supplier_audit_snapshot(supplier, include_empty_attrs=True)},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    await db.commit()
    await db.refresh(supplier)
    return SupplierRead.model_validate(supplier)


@router.get("/supplier-resources", response_model=ListResponse)
async def list_supplier_resources(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    supplier_id: Optional[int] = Query(default=None),
    resource_id: Optional[int] = Query(default=None),
    resource_ids: Optional[list[int]] = Query(default=None),
    supply_status: Optional[str] = Query(default=None),
):
    stmt = select(SupplierResource)
    if supplier_id:
        stmt = stmt.where(SupplierResource.supplier_id == supplier_id)
    if resource_id:
        stmt = stmt.where(SupplierResource.resource_id == resource_id)
    if resource_ids:
        stmt = stmt.where(SupplierResource.resource_id.in_(resource_ids))
    if supply_status:
        stmt = stmt.where(SupplierResource.supply_status == supply_status)

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[SupplierResourceRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/supplier-resources", response_model=SupplierResourceRead, status_code=status.HTTP_201_CREATED)
async def bind_supplier_resource(
    payload: SupplierResourceCreate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    supplier = await db.get(Supplier, payload.supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    resource = await db.get(Resource, payload.resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    dup = await db.scalar(
        select(SupplierResource).where(
            SupplierResource.supplier_id == payload.supplier_id,
            SupplierResource.resource_id == payload.resource_id,
        )
    )
    if dup:
        raise HTTPException(status_code=400, detail="Binding already exists")
    obj = SupplierResource(**payload.model_dump())
    db.add(obj)
    await db.flush()
    
    # Record audit log for binding
    audit = AuditLog(
        table_name="supplier_resource",
        record_id=obj.id,
        operation="CREATE",
        diff_data={"supplier_id": obj.supplier_id, "resource_id": obj.resource_id, "settlement_price": str(obj.settlement_price) if obj.settlement_price else None},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(obj)
    return SupplierResourceRead.model_validate(obj)


@router.delete("/supplier-resources/{supplier_resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier_resource(
    supplier_resource_id: int,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    sr = await db.get(SupplierResource, supplier_resource_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Supplier resource not found")

    audit = AuditLog(
        table_name="supplier_resource",
        record_id=sr.id,
        operation="DELETE",
        diff_data={
            "supplier_id": sr.supplier_id,
            "resource_id": sr.resource_id,
            "supply_status": sr.supply_status,
            "settlement_price": str(sr.settlement_price) if sr.settlement_price is not None else None,
        },
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    await db.delete(sr)
    await db.commit()
    return None


@router.post(
    "/supplier-resources/{supplier_resource_id}/adjust-price",
    response_model=SupplierResourceRead,
    status_code=status.HTTP_200_OK,
)
async def adjust_supplier_price(
    payload: SupplierResourceAdjust,
    db: DbSession,
    supplier_resource_id: int = Path(..., ge=1),
    user: User = Depends(get_current_user),
):
    sr = await db.get(SupplierResource, supplier_resource_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Supplier resource not found")

    before_price = sr.settlement_price
    sr.settlement_price = Decimal(str(payload.settlement_price))
    sr.updated_at = now_china()

    history = SupplierResourcePriceHistory(
        supplier_resource_id=sr.id,
        before_price=before_price,
        after_price=sr.settlement_price,
        reason=payload.reason,
        operator=user.username,
        operated_at=now_china(),
    )
    approval = Approval(
        object_type="supplier",
        object_id=sr.id,
        action_type="update_settlement_price",
        before_data={"settlement_price": str(before_price) if before_price is not None else None},
        after_data={"settlement_price": str(sr.settlement_price)},
        status="pending",
        applicant=user.username,
        approver="admin",
        applied_at=now_china(),
    )

    db.add(sr)
    db.add(history)
    db.add(approval)
    
    # Record audit log for price adjustment
    audit = AuditLog(
        table_name="supplier_resource",
        record_id=sr.id,
        operation="UPDATE",
        diff_data={"type": "settlement_price_change", "supplier_id": sr.supplier_id, "resource_id": sr.resource_id, "before_price": str(before_price) if before_price else None, "after_price": str(sr.settlement_price)},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(sr)
    return SupplierResourceRead.model_validate(sr)


@router.put("/suppliers/{supplier_id}", response_model=SupplierRead)
async def update_supplier(
    supplier_id: int,
    payload: SupplierCreate,  # Using create schema for update as fields are same
    db: DbSession,
    user: User = Depends(get_current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    if payload.supplier_name:
        dup = await db.scalar(select(Supplier).where(Supplier.supplier_name == payload.supplier_name, Supplier.id != supplier_id))
        if dup:
            raise HTTPException(status_code=400, detail="Supplier name already exists")
    
    # Capture before state
    before_data = _supplier_audit_snapshot(supplier, include_empty_attrs=True)

    update_data = payload.model_dump(exclude_unset=True)
    if "attrs" in update_data:
        update_data["attrs"] = _sanitize_supplier_attrs(update_data.get("attrs"))
    for field, value in update_data.items():
        setattr(supplier, field, value)

    after_data = _supplier_audit_snapshot(supplier, include_empty_attrs=True)
    
    # Record audit log
    audit = AuditLog(
        table_name="supplier",
        record_id=supplier.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": after_data},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(supplier)
    return SupplierRead.model_validate(supplier)


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: int,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    binding_count = await db.scalar(
        select(func.count()).select_from(SupplierResource).where(SupplierResource.supplier_id == supplier_id)
    )
    if binding_count and binding_count > 0:
        raise HTTPException(status_code=400, detail=f"无法删除供应商：已绑定 {binding_count} 个资源")
    
    # Record audit log before deletion
    audit = AuditLog(
        table_name="supplier",
        record_id=supplier.id,
        operation="DELETE",
        diff_data=_supplier_audit_snapshot(supplier),
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.delete(supplier)
    await db.commit()
    return None


@router.post("/suppliers/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_suppliers(
    supplier_ids: list[int],
    db: DbSession,
    _: User = Depends(get_current_user),
):
    if not supplier_ids:
        return None

    usage_rows = await db.execute(
        select(SupplierResource.supplier_id, func.count())
        .where(SupplierResource.supplier_id.in_(supplier_ids))
        .group_by(SupplierResource.supplier_id)
    )
    usage_map = {sid: cnt for sid, cnt in usage_rows.all()}
    if usage_map:
        blocked = sorted(usage_map.keys())
        preview = ", ".join(str(i) for i in blocked[:10])
        suffix = f" 等 {len(blocked)} 个供应商" if len(blocked) > 10 else ""
        raise HTTPException(status_code=400, detail=f"以下供应商仍绑定资源，无法删除: {preview}{suffix}")

    for supplier_id in supplier_ids:
        supplier = await db.get(Supplier, supplier_id)
        if supplier:
            await db.delete(supplier)
    await db.commit()
    return None


@router.post("/suppliers/batch-update")
async def batch_update_suppliers(
    updates: dict,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    """
    Batch update suppliers. Expects payload like:
    {
        "ids": [1, 2, 3],
        "fields": {"status": "inactive"}
    }
    """
    supplier_ids = updates.get("ids", [])
    fields = updates.get("fields", {})
    if not supplier_ids or not fields:
        return {"updated": 0, "pending": 0, "skipped": 0, "errors": []}

    allowed_fields = {
        "contact_info",
        "settlement_info",
        "qualification_files",
        "tags",
        "remark",
        "attrs",
    }
    invalid_fields = [k for k in fields.keys() if k not in allowed_fields]
    if invalid_fields:
        raise HTTPException(status_code=400, detail=f"批量更新仅支持字段: {', '.join(sorted(allowed_fields))}")

    if "attrs" in fields:
        fields["attrs"] = _sanitize_supplier_attrs(fields.get("attrs"))
    supplier_ids = list(dict.fromkeys(supplier_ids))
    suppliers = list(await db.scalars(select(Supplier).where(Supplier.id.in_(supplier_ids))))
    if len(suppliers) != len(supplier_ids):
        found_ids = {s.id for s in suppliers}
        missing = [sid for sid in supplier_ids if sid not in found_ids]
        raise HTTPException(status_code=404, detail=f"Supplier not found: {missing}")

    updated_count = 0
    for supplier in suppliers:
        for field, value in fields.items():
            if hasattr(supplier, field):
                setattr(supplier, field, value)
        updated_count += 1

    await db.commit()
    return {"updated": updated_count, "pending": 0, "skipped": 0, "errors": []}


# Supplier Resource Inventory Endpoints

@router.get("/supplier-resources/{supplier_resource_id}/inventory", response_model=list[ResourceInventoryRead])
async def list_supplier_resource_inventory(
    supplier_resource_id: int,
    start_date: str,
    end_date: str,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    """Get daily inventory for a supplier resource within a date range."""
    
    # Convert string dates to date objects (or rely on pydantic if using query model)
    # But here we use query params which are strings by default unless typed
    # Using str for safety and converting manually
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")
    if start > end:
        raise HTTPException(status_code=400, detail="start_date cannot be later than end_date")
    
    stmt = select(ResourceInventory).where(
        ResourceInventory.supplier_resource_id == supplier_resource_id,
        ResourceInventory.inventory_date >= start,
        ResourceInventory.inventory_date <= end
    ).order_by(ResourceInventory.inventory_date)
    
    rows = await db.scalars(stmt)
    return [ResourceInventoryRead.model_validate(r) for r in rows]


@router.post("/supplier-resources/inventory/batch", status_code=status.HTTP_200_OK)
async def batch_update_supplier_resource_inventory(
    payload: ResourceInventoryBatchUpdate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    print(f"Batch updating inventory: {payload}", flush=True)  # Debug log
    """Batch set inventory for a supplier resource over a date range."""
    from datetime import timedelta
    
    current_date = payload.start_date
    end_date = payload.end_date
    
    # Batch fetch existing records
    stmt = select(ResourceInventory).where(
        ResourceInventory.supplier_resource_id == payload.supplier_resource_id,
        ResourceInventory.inventory_date >= payload.start_date,
        ResourceInventory.inventory_date <= payload.end_date
    )
    existing_records = await db.scalars(stmt)
    existing_map = {r.inventory_date: r for r in existing_records}

    # Validate: new total cannot be less than sold + frozen
    invalid_dates = []
    check_date = current_date
    while check_date <= end_date:
        if payload.weekdays is None or check_date.weekday() in payload.weekdays:
            existing = existing_map.get(check_date)
            if existing and payload.total_qty < (existing.sold_qty + existing.frozen_qty):
                invalid_dates.append(
                    {
                        "date": check_date,
                        "sold": existing.sold_qty,
                        "frozen": existing.frozen_qty,
                    }
                )
        check_date += timedelta(days=1)
    if invalid_dates:
        sample = invalid_dates[0]
        raise HTTPException(
            status_code=400,
            detail=(
                f"总库存不能小于已售+冻结。冲突日期数: {len(invalid_dates)}，"
                f"示例: {sample['date']} (已售 {sample['sold']}，冻结 {sample['frozen']})"
            ),
        )

    # Reset cursor for update loop
    current_date = payload.start_date
    
    before_qty_sum = 0
    after_qty_sum = 0
    updated_count = 0
    created_count = 0
    
    created = []

    while current_date <= end_date:
        # Check weekdays filter
        if payload.weekdays is None or current_date.weekday() in payload.weekdays:
            
            # Check existing from map
            existing = existing_map.get(current_date)
            
            if existing:
                before_qty_sum += existing.total_qty
                existing.total_qty = payload.total_qty
                if payload.settlement_price is not None:
                    existing.settlement_price = Decimal(str(payload.settlement_price))
                existing.updated_at = now_china().isoformat()
                updated_count += 1
            else:
                new_inv = ResourceInventory(
                    supplier_resource_id=payload.supplier_resource_id,
                    inventory_date=current_date,
                    total_qty=payload.total_qty,
                    settlement_price=Decimal(str(payload.settlement_price)) if payload.settlement_price is not None else None,
                    status='active'
                )
                db.add(new_inv) # created list for add_all is better but db.add works too
                created_count += 1
            
            after_qty_sum += payload.total_qty
        
        current_date += timedelta(days=1)
    
    # Record audit log for batch inventory update
    audit = AuditLog(
        table_name="resource_inventory",
        record_id=payload.supplier_resource_id,
        operation="BATCH_UPDATE",
        diff_data={
            "supplier_resource_id": payload.supplier_resource_id,
            "date_range": f"{payload.start_date} ~ {payload.end_date}",
            "set_total_qty": payload.total_qty,
            "set_price": str(payload.settlement_price) if payload.settlement_price else None,
            "stats": {
                "records_updated": updated_count,
                "records_created": created_count,
                "before_sum_qty": before_qty_sum,
                "after_sum_qty": after_qty_sum, 
                "change_qty": after_qty_sum - before_qty_sum
            }
        },
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    return {"message": "Inventory updated successfully"}


