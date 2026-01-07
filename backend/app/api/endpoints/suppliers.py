from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import (
    Approval,
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


@router.get("/suppliers", response_model=ListResponse)
async def list_suppliers(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    ids: Optional[list[int]] = Query(default=None),
    keyword: Optional[str] = Query(default=None, description="Search keyword"),
    supplier_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
):
    stmt = select(Supplier)
    if ids:
        stmt = stmt.where(Supplier.id.in_(ids))
    if keyword:
        stmt = stmt.where(Supplier.supplier_name.ilike(f"%{keyword}%"))
    if supplier_type:
        stmt = stmt.where(Supplier.supplier_type == supplier_type)
    if status:
        stmt = stmt.where(Supplier.status == status)

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
    obj = Supplier(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return SupplierRead.model_validate(obj)


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
    _: User = Depends(get_current_user),
):
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
    await db.commit()
    await db.refresh(obj)
    return SupplierResourceRead.model_validate(obj)


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
    sr.updated_at = datetime.utcnow()

    history = SupplierResourcePriceHistory(
        supplier_resource_id=sr.id,
        before_price=before_price,
        after_price=sr.settlement_price,
        reason=payload.reason,
        operator=user.username,
        operated_at=datetime.utcnow(),
    )
    approval = Approval(
        object_type="supplier",
        object_id=sr.id,
        action_type="update_settlement_price",
        before_data={"settlement_price": str(before_price) if before_price is not None else None},
        after_data={"settlement_price": str(sr.settlement_price)},
        status="pending",
        applicant=user.username,
        approver="manager",  # Placeholder
        applied_at=datetime.utcnow(),
    )

    db.add(sr)
    db.add(history)
    db.add(approval)
    await db.commit()
    await db.refresh(sr)
    return SupplierResourceRead.model_validate(sr)


@router.put("/suppliers/{supplier_id}", response_model=SupplierRead)
async def update_supplier(
    supplier_id: int,
    payload: SupplierCreate,  # Using create schema for update as fields are same
    db: DbSession,
    _: User = Depends(get_current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(supplier, field, value)
    
    await db.commit()
    await db.refresh(supplier)
    return SupplierRead.model_validate(supplier)


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    supplier = await db.get(Supplier, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    await db.delete(supplier)
    await db.commit()
    return None


@router.post("/suppliers/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_suppliers(
    supplier_ids: list[int],
    db: DbSession,
    _: User = Depends(get_current_user),
):
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
    
    updated_count = 0
    for supplier_id in supplier_ids:
        supplier = await db.get(Supplier, supplier_id)
        if supplier:
            for field, value in fields.items():
                if hasattr(supplier, field):
                    setattr(supplier, field, value)
            updated_count += 1
    
    await db.commit()
    return {"updated": updated_count}


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
    from datetime import datetime
    
    # Convert string dates to date objects (or rely on pydantic if using query model)
    # But here we use query params which are strings by default unless typed
    # Using str for safety and converting manually
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    
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
    _: User = Depends(get_current_user),
):
    print(f"Batch updating inventory: {payload}", flush=True)  # Debug log
    """Batch set inventory for a supplier resource over a date range."""
    from datetime import timedelta
    
    current_date = payload.start_date
    end_date = payload.end_date
    
    while current_date <= end_date:
        # Check weekdays filter
        if payload.weekdays is None or current_date.weekday() in payload.weekdays:
            
            # Check existing
            stmt = select(ResourceInventory).where(
                ResourceInventory.supplier_resource_id == payload.supplier_resource_id,
                ResourceInventory.inventory_date == current_date
            )
            existing = await db.scalar(stmt)
            
            if existing:
                existing.total_qty = payload.total_qty
                if payload.settlement_price is not None:
                    existing.settlement_price = Decimal(str(payload.settlement_price))
                existing.updated_at = datetime.utcnow().isoformat()
            else:
                new_inv = ResourceInventory(
                    supplier_resource_id=payload.supplier_resource_id,
                    inventory_date=current_date,
                    total_qty=payload.total_qty,
                    settlement_price=Decimal(str(payload.settlement_price)) if payload.settlement_price is not None else None,
                    status='active'
                )
                db.add(new_inv)
        
        current_date += timedelta(days=1)
    
    await db.commit()
    return {"message": "Inventory updated successfully"}
