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

router = APIRouter()


@router.get("/suppliers", response_model=ListResponse)
async def list_suppliers(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    ids: Optional[list[int]] = Query(default=None),
    keyword: Optional[str] = Query(default=None, description="名称关键字"),
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
        raise HTTPException(status_code=400, detail="供应商已存在")
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
        raise HTTPException(status_code=400, detail="该供应商已绑定该资源")
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
        raise HTTPException(status_code=404, detail="供应关系不存在")

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
        action_type="结算价变更",
        before_data={"settlement_price": str(before_price) if before_price is not None else None},
        after_data={"settlement_price": str(sr.settlement_price)},
        status="pending",
        applicant=user.username,
        approver="manager",  # 占位，后续接入实际审批人逻辑
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
