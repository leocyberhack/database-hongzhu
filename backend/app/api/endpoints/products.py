from collections import Counter
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import User, get_current_user
from app.api.deps import DbSession
from app.models import Product, ProductResource, ProductStructureSnapshot, Sku, ProductCategory, Resource
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
    page_size: int = Query(default=100, ge=1, le=200),
):
    stmt = select(ProductCategory).where(ProductCategory.status == 'active')
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
    _: User = Depends(get_current_user),
):
    dup = await db.scalar(select(ProductCategory).where(ProductCategory.name == payload.name))
    if dup:
        raise HTTPException(status_code=400, detail="分类名称已存在")
    
    cat = ProductCategory(**payload.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return ProductCategoryRead.model_validate(cat)


@router.put("/product-categories/{category_id}", response_model=ProductCategoryRead)
async def update_product_category(
    category_id: int,
    payload: ProductCategoryCreate,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    cat = await db.get(ProductCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    
    cat.name = payload.name
    cat.description = payload.description
    cat.status = payload.status
    
    await db.commit()
    await db.refresh(cat)
    return ProductCategoryRead.model_validate(cat)


@router.delete("/product-categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_category(
    category_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    cat = await db.get(ProductCategory, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="分类不存在")
    await db.delete(cat)
    await db.commit()
    return None


# --- Products ---

@router.get("/products", response_model=ListResponse)
async def list_products(
    db: DbSession,
    _: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    keyword: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    category_id: Optional[int] = Query(default=None),
):
    stmt = select(Product)
    if keyword:
        stmt = stmt.where(Product.product_name.ilike(f"%{keyword}%"))
    if status:
        stmt = stmt.where(Product.status == status)
    if category_id:
        stmt = stmt.where(Product.category_id == category_id)
        
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.scalars(stmt.order_by(Product.id.desc()).offset((page - 1) * page_size).limit(page_size))
    # We might want to eagerly load resources or category in future, but for list view usually basic info is enough
    return ListResponse(
        items=[ProductRead.model_validate(r) for r in rows],
        pagination=Pagination(total=total or 0, page=page, page_size=page_size),
    )




@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    # structure_hash unique
    dup = await db.scalar(select(Product).where(Product.structure_hash == payload.structure_hash))
    # if dup:
    #     raise HTTPException(status_code=400, detail="structure_hash 已存在，请复用或确认")
    
    # Calculate POI
    poi_id = None
    if payload.resources:
        resource_ids = [line.resource_id for line in payload.resources]
        resources = await db.scalars(select(Resource).where(Resource.id.in_(resource_ids)))
        poi_counts = Counter([r.poi_id for r in resources])
        if poi_counts:
            poi_id = poi_counts.most_common(1)[0][0]

    product = Product(
        product_name=payload.product_name,
        description=payload.description,
        status=payload.status or "draft",
        structure_hash=payload.structure_hash,
        category_id=payload.category_id,
        suggested_price=payload.suggested_price,
        poi_id=poi_id,
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

    await db.commit()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.put("/products/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: int,
    payload: ProductCreate,
    db: DbSession,
    user: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="产品不存在")

    # Calculate POI from new resources
    poi_id = None
    if payload.resources:
        resource_ids = [line.resource_id for line in payload.resources]
        resources = await db.scalars(select(Resource).where(Resource.id.in_(resource_ids)))
        poi_counts = Counter([r.poi_id for r in resources])
        if poi_counts:
            poi_id = poi_counts.most_common(1)[0][0]

    # Update fields
    product.product_name = payload.product_name
    product.description = payload.description
    product.status = payload.status
    product.structure_hash = payload.structure_hash
    product.category_id = payload.category_id
    product.suggested_price = payload.suggested_price
    product.poi_id = poi_id
    
    # Update resources: delete all and recreate
    # First, delete existing resources
    await db.execute(select(ProductResource).where(ProductResource.product_id == product_id).execution_options(synchronize_session=False))
    # Using delete statement directly
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
    
    await db.commit()
    await db.refresh(product)
    return ProductRead.model_validate(product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: DbSession,
    _: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="产品不存在")
    
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
            updated_count += 1
    
    await db.commit()
    return {"updated": updated_count}


@router.get("/products/{product_id}", response_model=ProductRead)
async def get_product(db: DbSession, product_id: int = Path(..., ge=1), _: User = Depends(get_current_user)):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="产品不存在")
    return ProductRead.model_validate(product)


@router.post("/products/{product_id}/snapshot", response_model=ProductSnapshotRead)
async def snapshot_product(
    db: DbSession,
    product_id: int = Path(..., ge=1),
    _: User = Depends(get_current_user),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="产品不存在")
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
    snap = ProductStructureSnapshot(product_id=product_id, snapshot_data=snapshot_data, created_at=datetime.utcnow())
    db.add(snap)
    await db.commit()
    await db.refresh(snap)
    return ProductSnapshotRead.model_validate(snap)



