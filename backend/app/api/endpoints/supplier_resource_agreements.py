from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import (
    AuditLog,
    Supplier,
    Resource,
    SupplierResourceAgreement,
    SupplierResource,
)
from app.schemas.common import (
    SupplierResourceAgreementCreate,
    SupplierResourceAgreementRead,
    SupplierResourceAgreementUpdate,
)
from app.utils.time import now_china

router = APIRouter()

def _agreement_snapshot(
    agreement: SupplierResourceAgreement,
    supplier_resource: Optional[SupplierResource] = None,
    supplier: Optional[Supplier] = None,
    resource: Optional[Resource] = None,
) -> dict:
    payload = {
        "supplier_resource_id": agreement.supplier_resource_id,
        "agreement_name": agreement.agreement_name,
        "start_date": agreement.start_date,
        "end_date": agreement.end_date,
        "signing_date": agreement.signing_date,
        "status": agreement.status,
        "settlement_cycle": agreement.settlement_cycle,
        "payment_method": agreement.payment_method,
        "requires_invoice": agreement.requires_invoice,
        "invoice_type": agreement.invoice_type,
        "discount_methods": agreement.discount_methods,
        "discount_policy": agreement.discount_policy,
        "attached_files": agreement.attached_files,
    }
    if supplier_resource:
        payload["supplier_id"] = supplier_resource.supplier_id
        payload["resource_id"] = supplier_resource.resource_id
    if supplier:
        payload["supplier_name"] = supplier.supplier_name
    if resource:
        payload["resource_name"] = resource.resource_name
    return jsonable_encoder(payload)


async def _fetch_supplier_resource_context(
    db: DbSession,
    supplier_resource_id: int,
) -> tuple[Optional[SupplierResource], Optional[Supplier], Optional[Resource]]:
    supplier_resource = await db.get(SupplierResource, supplier_resource_id)
    if not supplier_resource:
        return None, None, None
    supplier = await db.get(Supplier, supplier_resource.supplier_id)
    resource = await db.get(Resource, supplier_resource.resource_id)
    return supplier_resource, supplier, resource


@router.get("", response_model=List[SupplierResourceAgreementRead])
async def list_agreements(
    db: DbSession,
    _: User = Depends(get_current_user),
    supplier_resource_id: Optional[int] = Query(default=None),
):
    stmt = select(SupplierResourceAgreement)
    if supplier_resource_id:
        stmt = stmt.where(SupplierResourceAgreement.supplier_resource_id == supplier_resource_id)
    rows = await db.scalars(stmt.order_by(SupplierResourceAgreement.created_at.desc()))
    return list(rows)


@router.post("", response_model=SupplierResourceAgreementRead, status_code=201)
async def create_agreement(
    payload: SupplierResourceAgreementCreate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    supplier_resource = await db.get(SupplierResource, payload.supplier_resource_id)
    if not supplier_resource:
        raise HTTPException(status_code=404, detail="供应商资源关联不存在")

    agreement = SupplierResourceAgreement(**payload.model_dump())
    db.add(agreement)
    await db.flush()

    supplier = await db.get(Supplier, supplier_resource.supplier_id)
    resource = await db.get(Resource, supplier_resource.resource_id)
    audit = AuditLog(
        table_name="supplier_resource_agreements",
        record_id=agreement.id,
        operation="CREATE",
        diff_data=_agreement_snapshot(agreement, supplier_resource, supplier, resource),
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    await db.commit()
    await db.refresh(agreement)
    return agreement


@router.get("/{agreement_id}", response_model=SupplierResourceAgreementRead)
async def get_agreement(
    agreement_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    agreement = await db.get(SupplierResourceAgreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="协议不存在")
    return agreement


@router.put("/{agreement_id}", response_model=SupplierResourceAgreementRead)
async def update_agreement(
    agreement_id: int,
    payload: SupplierResourceAgreementUpdate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    agreement = await db.get(SupplierResourceAgreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="协议不存在")

    supplier_resource, supplier, resource = await _fetch_supplier_resource_context(
        db,
        agreement.supplier_resource_id,
    )
    before_data = _agreement_snapshot(agreement, supplier_resource, supplier, resource)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(agreement, key, value)

    after_data = _agreement_snapshot(agreement, supplier_resource, supplier, resource)
    audit = AuditLog(
        table_name="supplier_resource_agreements",
        record_id=agreement.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": after_data},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    await db.commit()
    await db.refresh(agreement)
    return agreement


@router.delete("/{agreement_id}", status_code=204)
async def delete_agreement(
    agreement_id: int,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    agreement = await db.get(SupplierResourceAgreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="协议不存在")

    supplier_resource, supplier, resource = await _fetch_supplier_resource_context(
        db,
        agreement.supplier_resource_id,
    )
    audit = AuditLog(
        table_name="supplier_resource_agreements",
        record_id=agreement.id,
        operation="DELETE",
        diff_data=_agreement_snapshot(agreement, supplier_resource, supplier, resource),
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    await db.delete(agreement)
    await db.commit()
    return None
