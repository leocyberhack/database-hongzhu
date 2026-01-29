from typing import Any
from fastapi import APIRouter, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, func

from app.api.deps import DbSession
from app.models import Spu
from app.schemas.spu import SpuCreate, SpuUpdate, SpuResponse, SpuListResponse

router = APIRouter()

@router.get("", response_model=SpuListResponse)
async def list_spus(
    db: DbSession,
    page: int = 1,
    page_size: int = 20,
):
    skip = (page - 1) * page_size
    stmt = select(Spu).offset(skip).limit(page_size).order_by(Spu.id.desc()).options(selectinload(Spu.skus))
    result = await db.execute(stmt)
    spus = result.scalars().all()
    
    count_stmt = select(func.count()).select_from(Spu)
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()
    
    items = []
    for s in spus:
        s_dict = {c.name: getattr(s, c.name) for c in s.__table__.columns}
        s_dict['sku_count'] = len(s.skus)
        items.append(s_dict)

    return {"items": items, "pagination": {"total": total, "page": page, "page_size": page_size}}

@router.post("", response_model=SpuResponse)
async def create_spu(
    spu_in: SpuCreate,
    db: DbSession,
):
    spu = Spu(**spu_in.model_dump())
    db.add(spu)
    await db.commit()
    await db.refresh(spu)
    
    s_dict = {c.name: getattr(spu, c.name) for c in spu.__table__.columns}
    s_dict['sku_count'] = 0
    return s_dict

@router.get("/{spu_id}", response_model=SpuResponse)
async def read_spu(
    spu_id: int,
    db: DbSession,
):
    stmt = select(Spu).where(Spu.id == spu_id).options(selectinload(Spu.skus))
    result = await db.execute(stmt)
    spu = result.scalar_one_or_none()
    if not spu:
        raise HTTPException(status_code=404, detail="SPU not found")
        
    s_dict = {c.name: getattr(spu, c.name) for c in spu.__table__.columns}
    s_dict['sku_count'] = len(spu.skus)
    return s_dict

@router.put("/{spu_id}", response_model=SpuResponse)
async def update_spu(
    spu_id: int,
    spu_in: SpuUpdate,
    db: DbSession,
):
    result = await db.execute(select(Spu).where(Spu.id == spu_id).options(selectinload(Spu.skus)))
    spu = result.scalar_one_or_none()
    if not spu:
        raise HTTPException(status_code=404, detail="SPU not found")
        
    update_data = spu_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(spu, field, value)
    
    db.add(spu)
    await db.commit()
    # Re-query to get skus
    result = await db.execute(select(Spu).where(Spu.id == spu_id).options(selectinload(Spu.skus)))
    spu = result.scalar_one()

    s_dict = {c.name: getattr(spu, c.name) for c in spu.__table__.columns}
    s_dict['sku_count'] = len(spu.skus)
    return s_dict

@router.delete("/{spu_id}")
async def delete_spu(
    spu_id: int,
    db: DbSession,
):
    spu = await db.get(Spu, spu_id)
    if not spu:
        raise HTTPException(status_code=404, detail="SPU not found")
    await db.delete(spu)
    await db.commit()
    return {"ok": True}
