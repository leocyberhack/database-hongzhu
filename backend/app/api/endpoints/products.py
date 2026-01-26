from collections import Counter
from datetime import datetime
from app.utils.time import now_china
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import User, get_current_user, require_roles
from app.api.deps import DbSession
from app.models import AuditLog, Product, ProductResource, ProductStructureSnapshot, Sku, ProductCategory, Resource
from app.schemas.common import ListResponse, Pagination
from app.schemas.product import (
    ProductCreate,
    ProductRead,
    ProductSnapshotRead,
    ProductResourceLine,
    ProductCategoryCreate,
    ProductCategoryRead,
    ProductCategoryRead,
)
from app.schemas.inventory_preview import ProductInventoryPreviewRequest

router = APIRouter()


async def _has_order_for_product(db: AsyncSession, product_id: int) -> bool:
    # Placeholder: to be wired to Order table when exposed
    return False


# --- Product Categories ---

@router.get("/product-categories", response_model=ListResponse)
async def list_product_categories(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=1000),
):
    stmt = select(ProductCategory)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(ProductCategory.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return ListResponse(
        items=[ProductCategoryRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )


@router.post("/product-categories", response_model=ProductCategoryRead, status_code=status.HTTP_201_CREATED)
async def create_product_category(
    payload: ProductCategoryCreate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    dup = await db.scalar(select(ProductCategory).where(ProductCategory.name == payload.name))
    if dup:
        raise HTTPException(status_code=400, detail="该分类名称已存在")
    
    cat = ProductCategory(**payload.model_dump())
    db.add(cat)
    await db.flush()
    
    # Record audit log
    audit = AuditLog(
        table_name="product_category",
        record_id=cat.id,
        operation="CREATE",
        diff_data={"name": cat.name, "description": cat.description},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(cat)
    return ProductCategoryRead.model_validate(cat)


@router.put("/product-categories/{category_id}", response_model=ProductCategoryRead)
async def update_product_category(
    category_id: int,
    payload: ProductCategoryCreate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    cat = await db.get(ProductCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="未找到该分类")
    
    # Capture before state
    before_data = {"name": cat.name, "description": cat.description}
    
    cat.name = payload.name
    cat.description = payload.description
    
    # Record audit log
    audit = AuditLog(
        table_name="product_category",
        record_id=cat.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": {"name": payload.name, "description": payload.description}},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(cat)
    return ProductCategoryRead.model_validate(cat)


@router.delete("/product-categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_category(
    category_id: int,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    cat = await db.get(ProductCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="未找到该分类")
    
    # Record audit log before deletion
    audit = AuditLog(
        table_name="product_category",
        record_id=cat.id,
        operation="DELETE",
        diff_data={"name": cat.name, "description": cat.description},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.delete(cat)
    await db.commit()
    return None


# --- Products ---

@router.get("/products", response_model=ListResponse)
async def list_products(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=1000),
    keyword: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    category_id: Optional[int] = Query(default=None),
    sort_field: Optional[str] = Query(default=None),
    sort_order: Optional[str] = Query(default=None),
):
    stmt = select(Product)
    if keyword:
        stmt = stmt.where(Product.product_name.ilike(f"%{keyword}%"))
    if status:
        stmt = stmt.where(Product.status == status)
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
      
    # Sorting logic
    if sort_field and hasattr(Product, sort_field):
        field = getattr(Product, sort_field)
        if sort_order == "descend":
            stmt = stmt.order_by(field.desc())
        else:
            stmt = stmt.order_by(field.asc())
    else:
        # Default: Aggregate by POI
        stmt = stmt.order_by(Product.poi_id.asc(), Product.id.desc())
        
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.offset((page - 1) * page_size).limit(page_size))
    # We might want to eagerly load resources or category in future, but for list view usually basic info is enough
    return ListResponse(
        items=[ProductRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )




@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    name_dup = await db.scalar(select(Product).where(Product.product_name == payload.product_name))
    if name_dup:
        raise HTTPException(status_code=400, detail="产品名称已存在")
    # structure_hash unique
    dup = await db.scalar(select(Product).where(Product.structure_hash == payload.structure_hash))
    if dup:
        raise HTTPException(status_code=400, detail="structure_hash already exists")

    # Validate resource uniqueness
    if payload.resources:
        resource_ids = [r.resource_id for r in payload.resources]
        if len(resource_ids) != len(set(resource_ids)):
            raise HTTPException(status_code=400, detail="产品不能包含重复的资源")
    poi_id = None
    if payload.resources:
        resource_ids = [line.resource_id for line in payload.resources]
        resources_list = list(await db.scalars(select(Resource).where(Resource.id.in_(resource_ids))))
        
        # Logic Lock 1: Inactive resources cannot be used in products
        for r in resources_list:
            if r.status != "active":
                 raise HTTPException(status_code=400, detail=f"资源 {r.resource_name} 未上架，无法使用")

        poi_counts = Counter([r.poi_id for r in resources_list])
        if poi_counts:
            poi_id = poi_counts.most_common(1)[0][0]

    product = Product(
        product_name=payload.product_name,
        description=payload.description,
        status=payload.status or "draft",
        structure_hash=payload.structure_hash,
        category_id=payload.category_id,
        suggested_price=payload.suggested_price,
        base_cost=payload.base_cost,
        poi_id=poi_id,
        allowed_channels=[item.model_dump() for item in payload.allowed_channels] if payload.allowed_channels else [],
        created_by=user.username,
    )
    db.add(product)
    await db.flush()

    lines = []
    for line in payload.resources:
        lines.append(
            ProductResource(
                product_id=product.id,
                resource_id=line.resource_id,
                supplier_id=line.supplier_id,
                quantity=line.quantity,
                required_flag=line.required_flag,
                remark=line.remark,
            )
        )
    db.add_all(lines)
    
    # Record audit log
    audit = AuditLog(
        table_name="product",
        record_id=product.id,
        operation="CREATE",
        diff_data={"product_name": product.product_name, "status": product.status, "structure_hash": product.structure_hash},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)

    await db.commit()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.put("/products/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: int,
    payload: ProductCreate,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="未找到该产品")

    # Validations...
    name_dup = await db.scalar(select(Product).where(Product.product_name == payload.product_name, Product.id != product_id))
    if name_dup:
        raise HTTPException(status_code=400, detail="产品名称已存在")
    if payload.structure_hash != product.structure_hash:
        dup_hash = await db.scalar(
            select(Product).where(Product.structure_hash == payload.structure_hash, Product.id != product_id)
        )
        if dup_hash:
            raise HTTPException(status_code=400, detail="structure_hash already exists")
    if payload.resources:
        resource_ids = [r.resource_id for r in payload.resources]
        if len(resource_ids) != len(set(resource_ids)):
            raise HTTPException(status_code=400, detail="产品不能包含重复的资源")

    # Capture before data for audit log
    existing_resources = await db.scalars(select(ProductResource).where(ProductResource.product_id == product_id))
    existing_resource_list = [
        {"resource_id": r.resource_id, "supplier_id": r.supplier_id, "quantity": r.quantity} 
        for r in existing_resources
    ]
    
    before_data = {
        "product_name": product.product_name,
        "status": product.status,
        "category_id": product.category_id,
        "suggested_price": str(product.suggested_price) if product.suggested_price else None,
        "allowed_channels": product.allowed_channels,
        "resources": existing_resource_list
    }

    # Calculate POI from new resources
    poi_id = None
    if payload.resources:
        resource_ids = [line.resource_id for line in payload.resources]
        resources_list = list(await db.scalars(select(Resource).where(Resource.id.in_(resource_ids))))
        
        # Logic Lock 1: Inactive resources cannot be used in products
        for r in resources_list:
            if r.status != "active":
                 raise HTTPException(status_code=400, detail=f"资源 {r.resource_name} 未上架，无法使用")

        poi_counts = Counter([r.poi_id for r in resources_list])
        if poi_counts:
            poi_id = poi_counts.most_common(1)[0][0]

    # Update fields
    product.product_name = payload.product_name
    product.description = payload.description
    
    # Logic Lock 3: Products with associated SKUs cannot be deactivated (taken off shelves)
    if product.status == "active" and payload.status != "active":
        sku_count = await db.scalar(select(func.count()).where(Sku.product_id == product_id))
        if sku_count and sku_count > 0:
             raise HTTPException(status_code=400, detail="无法下架已关联SKU的产品")
    
    product.status = payload.status
    product.structure_hash = payload.structure_hash
    product.category_id = payload.category_id
    product.suggested_price = payload.suggested_price
    product.base_cost = payload.base_cost
    product.poi_id = poi_id
    product.allowed_channels = [item.model_dump() for item in payload.allowed_channels] if payload.allowed_channels else []
    product.updated_at = func.now()
    
    # Update resources: delete all and recreate
    from sqlalchemy import delete
    await db.execute(delete(ProductResource).where(ProductResource.product_id == product_id))
    
    # Add new resources
    lines = []
    for line in payload.resources:
        lines.append(
            ProductResource(
                product_id=product.id,
                resource_id=line.resource_id,
                supplier_id=line.supplier_id,
                quantity=line.quantity,
                required_flag=line.required_flag,
                remark=line.remark,
            )
        )
    db.add_all(lines)
    
    # Record audit log
    after_resource_list = [
        {"resource_id": line.resource_id, "supplier_id": line.supplier_id, "quantity": line.quantity} 
        for line in payload.resources
    ]
    after_data = {
        "product_name": product.product_name,
        "status": product.status,
        "category_id": product.category_id,
        "suggested_price": str(product.suggested_price) if product.suggested_price else None,
        "allowed_channels": product.allowed_channels,
        "resources": after_resource_list
    }
    
    audit = AuditLog(
        table_name="product",
        record_id=product.id,
        operation="UPDATE",
        diff_data={"before": before_data, "after": after_data},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: DbSession,
    user: User = Depends(require_roles(["admin", "super_admin", "product"])),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="未找到该产品")
    
    # Record audit log before deletion
    audit = AuditLog(
        table_name="product",
        record_id=product.id,
        operation="DELETE",
        diff_data={"product_name": product.product_name, "status": product.status},
        operator=user.username,
        operated_at=now_china(),
        source="web",
    )
    db.add(audit)
    
    # First delete related SKUs to avoid foreign key constraint violation
    from sqlalchemy import delete
    await db.execute(delete(Sku).where(Sku.product_id == product_id))
    
    # Then delete the product
    await db.delete(product)
    await db.commit()
    return None


@router.post("/products/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
async def batch_delete_products(
    product_ids: list[int],
    db: DbSession,
    _: User = Depends(get_current_user),
):
    from sqlalchemy import delete
    await db.execute(delete(Product).where(Product.id.in_(product_ids)))
    await db.commit()
    return None


@router.post("/products/batch-update")
async def batch_update_products(
    updates: dict,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    product_ids = updates.get("ids", [])
    fields = updates.get("fields", {})
    
    updated_count = 0
    for pid in product_ids:
        product = await db.get(Product, pid)
        if product:
            for field, value in fields.items():
                if hasattr(product, field):
                    setattr(product, field, value)
            product.updated_at = func.now()
            updated_count += 1
    
    await db.commit()
    return {"updated": updated_count}


@router.get("/products/{product_id}", response_model=ProductRead)
async def get_product(db: DbSession, product_id: int = Path(..., ge=1), _: User = Depends(get_current_user)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="未找到该产品")
    return ProductRead.model_validate(product)


@router.post("/products/{product_id}/snapshot", response_model=ProductSnapshotRead)
async def snapshot_product(
    db: DbSession,
    product_id: int = Path(..., ge=1),
    _: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="未找到该产品")
    resources = await db.scalars(select(ProductResource).where(ProductResource.product_id == product_id))
    snapshot_data = [
        {
            "resource_id": r.resource_id,
            "supplier_id": r.supplier_id,
            "quantity": r.quantity,
            "required_flag": r.required_flag,
            "remark": r.remark,
        }
        for r in resources
    ]
    snap = ProductStructureSnapshot(product_id=product_id, snapshot_data=snapshot_data, created_at=now_china())
    db.add(snap)
    await db.commit()
    await db.refresh(snap)
    return ProductSnapshotRead.model_validate(snap)


@router.get("/products/{product_id}/inventory")
async def get_product_inventory(
    db: DbSession,
    product_id: int = Path(..., ge=1),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    _: User = Depends(get_current_user),
):
    """
    Calculate product inventory for a date range.
    
    Product inventory = MIN(resource_inventory / resource_quantity) for all required resources.
    
    Returns a list of { date, available_qty } for each date in range.
    """
    from datetime import datetime, timedelta
    from app.models import ResourceInventory, SupplierResource
    
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="未找到该产品")
    
    # Get all product resources (with quantities)
    resources_stmt = select(ProductResource).where(ProductResource.product_id == product_id)
    product_resources = list(await db.scalars(resources_stmt))
    
    if not product_resources:
        return {"items": [], "message": "产品未关联任何资源"}
    required_resources = [pr for pr in product_resources if pr.required_flag]
    if not required_resources:
        return {"items": [], "message": "产品未配置必选资源"}
    
    # Parse date range or default
    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的开始日期格式，应为 YYYY-MM-DD")
    else:
        start = now_china().date()

    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的结束日期格式，应为 YYYY-MM-DD")
    else:
        end = (now_china() + timedelta(days=365*2)).date()

    if start > end:
        raise HTTPException(status_code=400, detail="开始日期不能晚于结束日期")
    
    # Get all resource IDs needed
    resource_ids = [pr.resource_id for pr in required_resources]
    
    # Fetch all resource inventories in the date range (Join SupplierResource to resolve resource_id and supplier_id)
    inv_stmt = select(ResourceInventory, SupplierResource.resource_id, SupplierResource.supplier_id).join(SupplierResource).where(
        SupplierResource.resource_id.in_(resource_ids),
        ResourceInventory.inventory_date >= start,
        ResourceInventory.inventory_date <= end
    )
    # Execute and fetch tuples (inv, resource_id, supplier_id)
    inventory_rows = (await db.execute(inv_stmt)).all()
    
    # Build lookups:
    # detailed_lookup: { (resource_id, supplier_id, date_str): qty } for specific supplier binding
    # total_lookup: { (resource_id, date_str): total_qty } for unbound resources
    detailed_lookup = {}
    total_lookup = {}
    
    for inv, r_id, s_id in inventory_rows:
        date_str = str(inv.inventory_date)
        available = max(0, inv.total_qty - inv.sold_qty - inv.frozen_qty)
        
        # Update detailed map
        detailed_key = (r_id, s_id, date_str)
        detailed_lookup[detailed_key] = detailed_lookup.get(detailed_key, 0) + available
        
        # Update total map
        total_key = (r_id, date_str)
        total_lookup[total_key] = total_lookup.get(total_key, 0) + available
    
    # Calculate product inventory for each date
    result = []
    current = start
    while current <= end:
        date_str = str(current)
        
        # For each date, calculate MIN(resource_available / resource_quantity)
        min_qty = None
        for pr in required_resources:
            # Determine which inventory pool to use
            if pr.supplier_id is not None:
                # Specific supplier bound
                resource_available = detailed_lookup.get((pr.resource_id, pr.supplier_id, date_str), 0)
            else:
                # No binding, use accumulated total
                resource_available = total_lookup.get((pr.resource_id, date_str), 0)
                
            if pr.quantity > 0:
                qty_from_resource = resource_available // pr.quantity
            else:
                qty_from_resource = 0
            
            if min_qty is None:
                min_qty = qty_from_resource
            else:
                min_qty = min(min_qty, qty_from_resource)
        
        result.append({
            "date": date_str,
            "available_qty": min_qty if min_qty is not None else 0
        })
        
        current += timedelta(days=1)
    
    return {"items": result}


@router.post("/products/inventory/preview", response_model=dict)
async def preview_product_inventory(
    payload: "ProductInventoryPreviewRequest",
    db: DbSession,
    _: User = Depends(get_current_user),
):
    """
    Preview product inventory based on a hypothetical list of resources.
    Calculates MIN(resource_available / resource_quantity) for the date range.
    """
    from datetime import datetime, timedelta
    from app.models import ResourceInventory, SupplierResource
    
    if not payload.resources:
        return {"items": []}

    if not payload.resources:
        return {"items": []}

    # Determine date range
    # If not provided, default to [Today, Today + 730 days] (2 years)
    today = datetime.now().date()
    
    if payload.start_date:
        try:
            start = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的开始日期格式，应为 YYYY-MM-DD")
    else:
        start = today

    if payload.end_date:
        try:
            end = datetime.strptime(payload.end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的结束日期格式，应为 YYYY-MM-DD")
    else:
        # Default to 2 years future to catch most inventory
        end = today + timedelta(days=730)
    
    if start > end:
        raise HTTPException(status_code=400, detail="开始日期不能晚于结束日期")

    # Get all resource IDs needed
    resource_ids = [r.resource_id for r in payload.resources]
    
    # Fetch all resource inventories in the date range
    # We fetch ALL records for these resources in the timeframe
    inv_stmt = select(ResourceInventory, SupplierResource.resource_id, SupplierResource.supplier_id).join(SupplierResource).where(
        SupplierResource.resource_id.in_(resource_ids),
        ResourceInventory.inventory_date >= start,
        ResourceInventory.inventory_date <= end
    )
    inventory_rows = (await db.execute(inv_stmt)).all()
    
    # Build lookups
    # Map: Date -> (ResourceID, SupplierID) -> Qty
    # We use a nested map structure for efficient querying per date
    # date_inventory_map[date_str][(resource_id, supplier_id)] = qty
    # date_inventory_map[date_str][(resource_id, None)] = total_qty (if we tracked unbound total, but here we calculate it)
    
    # Actually, simpler: 
    # detailed_lookup: { (resource_id, supplier_id, date_str): qty }
    # total_lookup: { (resource_id, date_str): total_qty }
    
    detailed_lookup = {}
    total_lookup = {}
    
    # Track all unique dates encountered
    all_dates = set()

    for inv, r_id, s_id in inventory_rows:
        date_str = str(inv.inventory_date)
        all_dates.add(inv.inventory_date)
        
        available = max(0, inv.total_qty - inv.sold_qty - inv.frozen_qty)
        
        # detailed map
        detailed_key = (r_id, s_id, date_str)
        detailed_lookup[detailed_key] = detailed_lookup.get(detailed_key, 0) + available
        
        # total map (by resource only)
        total_key = (r_id, date_str)
        total_lookup[total_key] = total_lookup.get(total_key, 0) + available

    sorted_dates = sorted(list(all_dates))
    
    result = []
    
    # Calculate product inventory for each date that has ANY resource inventory
    # Note: If a day is missing some resource inventory record entirely, it implies 0 stock for that resource.
    
    for current_date in sorted_dates:
        date_str = str(current_date)
        
        # Calculate MIN(resource_available / resource_quantity)
        min_qty = None
        
        # Check sufficient stock for ALL required resources
        is_buildable = True

        for pr in payload.resources:
            # Determine which inventory pool to use
            if pr.supplier_id is not None:
                resource_available = detailed_lookup.get((pr.resource_id, pr.supplier_id, date_str), 0)
            else:
                resource_available = total_lookup.get((pr.resource_id, date_str), 0)
                
            if pr.quantity > 0:
                qty_from_resource = resource_available // pr.quantity
            else:
                qty_from_resource = 99999999 
            
            if qty_from_resource == 0:
                is_buildable = False
                break
            
            if min_qty is None:
                min_qty = qty_from_resource
            else:
                min_qty = min(min_qty, qty_from_resource)

        # Only add to result if product is buildable (qty > 0)
        # User requested "inventory not 0 time period"
        if is_buildable and min_qty is not None and min_qty > 0:
             result.append({
                "date": date_str,
                "available_qty": min_qty if min_qty < 99999999 else 0
            })
    
    return {"items": result}
