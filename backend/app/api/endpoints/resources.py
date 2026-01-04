from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import Poi, Resource
from app.schemas.common import (
    ListResponse,
    Pagination,
    PoiCreate,
    PoiRead,
    PoiUpdate,
    ResourceCreate,
    ResourceRead,
    ResourceUpdate,
)

router = APIRouter()


@router.get("/poi", response_model=ListResponse)
async def list_poi(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    keyword: Optional[str] = Query(default=None),
):
    stmt = select(Poi)
    if keyword:
        stmt = stmt.where(Poi.poi_name.ilike(f"%{keyword}%"))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[PoiRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/poi", response_model=PoiRead, status_code=status.HTTP_201_CREATED)
async def create_poi(
    payload: PoiCreate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    # Unique check (poi_name + city)
    exists = await db.scalar(
        select(Poi).where(Poi.poi_name == payload.poi_name, Poi.city == payload.city)
    )
    if exists:
        raise HTTPException(status_code=400, detail="POI already exists for this city")
    obj = Poi(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return PoiRead.model_validate(obj)


@router.put("/poi/{poi_id}", response_model=PoiRead)
async def update_poi(
    poi_id: int,
    payload: PoiUpdate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    poi = await db.get(Poi, poi_id)
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    
    # Update only provided fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(poi, field, value)
    
    await db.commit()
    await db.refresh(poi)
    return PoiRead.model_validate(poi)


@router.delete("/poi/{poi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poi(
    poi_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    poi = await db.get(Poi, poi_id)
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    await db.delete(poi)
    await db.commit()
    return None


@router.post("/poi/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_poi(
    poi_ids: list[int],
    db: DbSession,
    _: User = Depends(get_current_user),
):
    for poi_id in poi_ids:
        poi = await db.get(Poi, poi_id)
        if poi:
            await db.delete(poi)
    await db.commit()
    return None


@router.post("/poi/batch-update")
async def batch_update_poi(
    updates: dict,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    """
    Batch update POIs. Expects payload like:
    {
        "ids": [1, 2, 3],
        "fields": {"city": "北京"}
    }
    """
    poi_ids = updates.get("ids", [])
    fields = updates.get("fields", {})
    
    updated_count = 0
    for poi_id in poi_ids:
        poi = await db.get(Poi, poi_id)
        if poi:
            for field, value in fields.items():
                if hasattr(poi, field):
                    setattr(poi, field, value)
            updated_count += 1
    
    await db.commit()
    return {"updated": updated_count}


@router.get("/resources", response_model=ListResponse)
async def list_resources(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    ids: Optional[list[int]] = Query(default=None),
    poi_id: Optional[int] = Query(default=None),
    resource_type: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
):
    stmt = select(Resource)
    if ids:
        stmt = stmt.where(Resource.id.in_(ids))
    if poi_id:
        stmt = stmt.where(Resource.poi_id == poi_id)
    if resource_type:
        stmt = stmt.where(Resource.resource_type == resource_type)
    if keyword:
        stmt = stmt.where(Resource.resource_name.ilike(f"%{keyword}%"))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[ResourceRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/resources", response_model=ResourceRead, status_code=status.HTTP_201_CREATED)
async def create_resource(
    payload: ResourceCreate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    # Optional duplicate warning (poi_id + name + type)
    dup = await db.scalar(
        select(Resource).where(
            Resource.poi_id == payload.poi_id,
            Resource.resource_name == payload.resource_name,
            Resource.resource_type == payload.resource_type,
        )
    )
    if dup:
        raise HTTPException(status_code=400, detail="Resource may duplicate under the same POI")

    obj = Resource(**payload.model_dump())
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return ResourceRead.model_validate(obj)


@router.put("/resources/{resource_id}", response_model=ResourceRead)
async def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Update only provided fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(resource, field, value)
    
    await db.commit()
    await db.refresh(resource)
    return ResourceRead.model_validate(resource)


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    await db.delete(resource)
    await db.commit()
    return None


@router.post("/resources/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_resources(
    resource_ids: list[int],
    db: DbSession,
    _: User = Depends(get_current_user),
):
    for resource_id in resource_ids:
        resource = await db.get(Resource, resource_id)
        if resource:
            await db.delete(resource)
    await db.commit()
    return None


@router.post("/resources/batch-update")
async def batch_update_resources(
    updates: dict,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    """
    Batch update resources. Expects payload like:
    {
        "ids": [1, 2, 3],
        "fields": {"status": "inactive"}
    }
    """
    resource_ids = updates.get("ids", [])
    fields = updates.get("fields", {})
    
    updated_count = 0
    for resource_id in resource_ids:
        resource = await db.get(Resource, resource_id)
        if resource:
            for field, value in fields.items():
                if hasattr(resource, field):
                    setattr(resource, field, value)
            updated_count += 1
    
    await db.commit()
    return {"updated": updated_count}
