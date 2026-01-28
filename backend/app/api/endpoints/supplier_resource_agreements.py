from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import SupplierResourceAgreement, SupplierResource
from app.schemas.common import (
    SupplierResourceAgreementCreate,
    SupplierResourceAgreementRead,
    SupplierResourceAgreementUpdate,
)

router = APIRouter()


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
        raise HTTPException(status_code=404, detail="Supplier resource not found")

    agreement = SupplierResourceAgreement(**payload.model_dump())
    db.add(agreement)
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
        raise HTTPException(status_code=404, detail="Agreement not found")
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
        raise HTTPException(status_code=404, detail="Agreement not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(agreement, key, value)

    await db.commit()
    await db.refresh(agreement)
    return agreement


@router.delete("/{agreement_id}", status_code=204)
async def delete_agreement(
    agreement_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    agreement = await db.get(SupplierResourceAgreement, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")

    await db.delete(agreement)
    await db.commit()
    return None
