from datetime import datetime
from app.utils.time import now_china
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import AuditLog, Poi, Resource
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
    page_size: int = Query(default=20, ge=1, le=1000),
    keyword: Optional[str] = Query(default=None),
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
):
    stmt = select(Poi)
    if keyword:
        stmt = stmt.where(Poi.poi_name.ilike(f"%{keyword}%"))
    
    # Sorting logic
    if sort_field and hasattr(Poi, sort_field):
        field = getattr(Poi, sort_field)
        if sort_order == "descend":
            stmt = stmt.order_by(field.desc())
        else:
            stmt = stmt.order_by(field.asc())
    else:
        # Default: Aggregate by city (Cluster by city)
        # Use city asc, then id desc
        stmt = stmt.order_by(Poi.city.asc(), Poi.id.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[PoiRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


# ... (create, update, delete omitted, keeping file intact) ...


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
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
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
        
    # Sorting logic
    if sort_field and hasattr(Resource, sort_field):
        field = getattr(Resource, sort_field)
        if sort_order == "descend":
            stmt = stmt.order_by(field.desc())
        else:
            stmt = stmt.order_by(field.asc())
    else:
        # Default: Aggregate by POI
        stmt = stmt.order_by(Resource.poi_id.asc(), Resource.id.desc())

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[ResourceRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/poi", response_model=PoiRead, status_code=status.HTTP_201_CREATED)
async def create_poi(
    payload: PoiCreate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    # Unique check by name（全局不重复，编辑未改名允许）
    exists = await db.scalar(select(Poi).where(Poi.poi_name == payload.poi_name))
    if exists:
        raise HTTPException(status_code=400, detail="POI name already exists")
    obj = Poi(**payload.model_dump())
    db.add(obj)
    await db.flush()
    
    # Record audit log
    audit = AuditLog(
        table_name="poi",
        record_id=obj.id,
        operation="CREATE",
        diff_data={"poi_name": obj.poi_name, "city": obj.city},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(obj)
    return PoiRead.model_validate(obj)


@router.put("/poi/{poi_id}", response_model=PoiRead)
async def update_poi(
    poi_id: int,
    payload: PoiUpdate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    poi = await db.get(Poi, poi_id)
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")

    # Name uniqueness：同名其他记录不允许
    if payload.poi_name:
        dup = await db.scalar(select(Poi).where(Poi.poi_name == payload.poi_name, Poi.id != poi_id))
        if dup:
            raise HTTPException(status_code=400, detail="POI name already exists")
    
    # Capture before state (only serializable fields)
    before_data = {
        "poi_name": poi.poi_name, 
        "city": poi.city, 
        "status": poi.status
    }
    if poi.address:
        before_data["address"] = poi.address
    
    # Update only provided fields
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(poi, field, value)
    
    # Capture after state (only serializable fields)
    after_data = {
        "poi_name": poi.poi_name,
        "city": poi.city,
        "status": poi.status
    }
    if poi.address:
        after_data["address"] = poi.address
    
    # Record audit log
    audit = AuditLog(
        table_name="poi",
        record_id=poi.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": after_data},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(poi)
    return PoiRead.model_validate(poi)


@router.delete("/poi/{poi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poi(
    poi_id: int,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    poi = await db.get(Poi, poi_id)
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    
    # Record audit log before deletion
    audit = AuditLog(
        table_name="poi",
        record_id=poi.id,
        operation="DELETE",
        diff_data={"poi_name": poi.poi_name, "city": poi.city},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
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
        "fields": {"city": "鍖椾含"}
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





@router.post("/resources", response_model=ResourceRead, status_code=status.HTTP_201_CREATED)
async def create_resource(
    payload: ResourceCreate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    # 资源名称全局唯一（编辑未改名允许）
    dup = await db.scalar(select(Resource).where(Resource.resource_name == payload.resource_name))
    if dup:
        raise HTTPException(status_code=400, detail="Resource name already exists")

    obj = Resource(**payload.model_dump())
    db.add(obj)
    await db.flush()
    
    # Record audit log with complete resource data including attrs
    audit_data = {
        "resource_name": obj.resource_name,
        "resource_type": obj.resource_type,
        "poi_id": obj.poi_id,
        "status": obj.status
    }
    # Include attrs if present (门票/酒店特定字段)
    if obj.attrs:
        audit_data["attrs"] = obj.attrs
    
    audit = AuditLog(
        table_name="resource",
        record_id=obj.id,
        operation="CREATE",
        diff_data=audit_data,
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(obj)
    return ResourceRead.model_validate(obj)


@router.put("/resources/{resource_id}", response_model=ResourceRead)
async def update_resource(
    resource_id: int,
    payload: ResourceUpdate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    if payload.resource_name:
        dup = await db.scalar(select(Resource).where(Resource.resource_name == payload.resource_name, Resource.id != resource_id))
        if dup:
            raise HTTPException(status_code=400, detail="Resource name already exists")
    
    # Capture before state with all important fields including attrs
    before_data = {
        "resource_name": resource.resource_name,
        "resource_type": resource.resource_type,
        "status": resource.status,
        "poi_id": resource.poi_id
    }
    if resource.attrs:
        before_data["attrs"] = resource.attrs
    
    # Validations
    update_data = payload.model_dump(exclude_unset=True)
    
    # Logic Lock 1: Active resources used by products cannot be deactivated
    if "status" in update_data and update_data["status"] != resource.status:
        if resource.status == "active" and update_data["status"] != "active": # Assuming target is inactive/draft
             # Check usage
             from app.models import ProductResource
             usage_count = await db.scalar(select(func.count()).where(ProductResource.resource_id == resource_id))
             if usage_count and usage_count > 0:
                 raise HTTPException(status_code=400, detail="Cannot deactivate resource used by products")

    for field, value in update_data.items():
        setattr(resource, field, value)
    
    # Record audit log with complete before/after data
    audit = AuditLog(
        table_name="resource",
        record_id=resource.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": update_data},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(resource)
    return ResourceRead.model_validate(resource)


@router.delete("/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(
    resource_id: int,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    from app.models import ProductResource, SupplierResource
    
    resource = await db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Only check if resource is referenced by products (ProductResource)
    product_resource_count = await db.scalar(
        select(func.count()).select_from(ProductResource).where(ProductResource.resource_id == resource_id)
    )
    if product_resource_count and product_resource_count > 0:
        raise HTTPException(status_code=400, detail=f"鏃犳硶鍒犻櫎锛氳璧勬簮琚?{product_resource_count} 涓骇鍝佸紩鐢紝璇峰厛鍒犻櫎鐩稿叧浜у搧璧勬簮鍏宠仈")
    
    # Record audit log before deletion
    audit = AuditLog(
        table_name="resource",
        record_id=resource.id,
        operation="DELETE",
        diff_data={"resource_name": resource.resource_name, "resource_type": resource.resource_type},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    # Delete related SupplierResource records first (supplier-resource associations)
    # Note: ResourceInventory records are automatically cascade-deleted via SupplierResource FK
    from sqlalchemy import delete
    await db.execute(delete(SupplierResource).where(SupplierResource.resource_id == resource_id))
    
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



