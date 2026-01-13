from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.auth import User, require_roles
from app.api.deps import DbSession
from app.models import Resource, Poi, Supplier, SupplierResource, AuditLog
from app.utils.excel_handler import generate_excel_template, parse_excel_data
from app.utils.time import now_china

router = APIRouter()

from urllib.parse import quote

@router.get("/template", response_class=StreamingResponse)
async def download_resource_template(
    resource_type: str,
    user: User = Depends(require_roles(["admin", "super_admin", "product"]))
):
    """
    下载资源导入Excel模板
    """
    try:
        excel_bytes = generate_excel_template(resource_type)
        filename = f"{resource_type}_import_template.xlsx"
        # 使用 RFC 5987 标准格式处理中文文件名，避免 latin-1 编码错误
        encoded_filename = quote(filename)
        
        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename*=utf-8''{encoded_filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"模板生成失败: {str(e)}")


import io

@router.post("/import", status_code=status.HTTP_200_OK)
async def import_resources(
    file: UploadFile = File(...),
    resource_type: str = Form(...),
    db: DbSession = None,  # Will be injected
    user: User = Depends(require_roles(["admin", "super_admin", "product"]))
):
    """
    批量导入资源
    """
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="只支持 .xlsx 文件")

    content = await file.read()
    
    try:
        # 1. 解析 Excel 数据
        # 这一步可能会抛出 ValueError，如果是格式错误
        data_list = parse_excel_data(content, resource_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel解析失败: {str(e)}")

    if not data_list:
        return {"message": "文件为空或无有效数据"}

    # 2. 数据库事务处理
    # FastAPI 的 DbSession (async session) 依赖注入已经在 route scope 内开启了事务
    # 但为了确保全有或全无（all or nothing），我们需要小心处理异常，一旦报错整个请求回滚
    
    imported_count = 0
    updated_count = 0
    
    try:
        for row in data_list:
            # === 1. 处理 POI ===
            poi_name = row["poi_name"]
            # 查找已存在的 POI (假设同一个城市可能重名? 当前模型约束是 poi_name + city 唯一)
            # Excel 只给了 poi_name，没有 city。我们假设全库按名查找，如果重名会有问题，
            # 这里简单起见：假设全局按照名称查找。
            # 实际上 POI 唯一键是 (poi_name, city)。但导入模板没填 city。
            # 策略：查找 exact match on poi_name。如果有多个... 这里有歧义。
            # 为了简化 MVP，查找第一个匹配的名字，如果没有则新建（city为空字符串或者默认值）
            
            stmt = select(Poi).where(Poi.poi_name == poi_name)
            poi_result = await db.scalars(stmt)
            existing_pois = poi_result.all()
            
            poi = None
            if existing_pois:
                poi = existing_pois[0] # 使用找到的第一个
            else:
                # 新建 POI
                poi = Poi(
                    poi_name=poi_name,
                    city="", # 默认为空，等待后续完善
                    address="",
                    status="active"
                )
                db.add(poi)
                await db.flush() # 获取 ID
                
                # Audit Log
                db.add(AuditLog(
                    table_name="poi",
                    record_id=poi.id,
                    operation="CREATE",
                    diff_data={"poi_name": poi_name, "source": "import"},
                    operator=user.username,
                    operated_at=now_china(),
                    source="import"
                ))

            # === 2. 处理 Resource ===
            res_name = row["resource_name"]
            
            stmt_res = select(Resource).where(Resource.resource_name == res_name)
            existing_res = await db.scalar(stmt_res)
            
            resource = None
            # 准备 attrs
            row_attrs = row["attrs"]
            
            if existing_res:
                # 更新模式
                resource = existing_res
                # 记录变更前状态
                before_data = {"attrs": resource.attrs, "poi_id": resource.poi_id}
                
                # 更新字段
                resource.poi_id = poi.id
                resource.resource_type = resource_type # 虽然通常不改类型，但这里强制一致
                # 合并 attrs? 还是覆盖？需求说：覆盖这个资源的字段信息
                # 如果 row_attrs 里是 None 的字段怎么处理？"空白cell视为空白"，解析器里没放入 dict
                # 我们可以做一个 merge，或者直接用新的覆盖旧的（除了 null 值）
                # 简单做法：用新解析出的非空值更新 resource.attrs
                current_attrs = resource.attrs or {}
                # 注意：如果导入的是部分属性，完全覆盖可能丢失之前的。
                # 但需求说："覆盖这个资源的字段信息"，意味着以 Excel 为准。
                # 建议：Excel 中存在的列，覆盖；Excel 中没填的，保留？还是清空？
                # 需求说："空白cell统统视为空白"。这通常意味着该字段值为空。
                # 配合解析器逻辑：解析器只返回了 headers 里有的列。
                # 我们假设 Excel 里的空就是空。
                # 这里采用 Update 策略：将解析出的 attrs 覆盖进 current_attrs
                if row_attrs:
                    current_attrs.update(row_attrs)
                    resource.attrs = current_attrs
                
                db.add(AuditLog(
                    table_name="resource",
                    record_id=resource.id,
                    operation="UPDATE",
                    diff_data={"before": before_data, "after": {"attrs": resource.attrs, "poi_id": poi.id}},
                    operator=user.username,
                    operated_at=now_china(),
                    source="import"
                ))
                updated_count += 1
            else:
                # 创建模式
                resource = Resource(
                    poi_id=poi.id,
                    resource_name=res_name,
                    resource_type=resource_type,
                    attrs=row_attrs,
                    status="active"
                )
                db.add(resource)
                await db.flush()
                
                db.add(AuditLog(
                    table_name="resource",
                    record_id=resource.id,
                    operation="CREATE",
                    diff_data={"resource_name": res_name, "attrs": row_attrs},
                    operator=user.username,
                    operated_at=now_china(),
                    source="import"
                ))
                imported_count += 1

            # === 3. 处理 Suppliers ===
            # row["suppliers"] 是一个 list dict: [{"name": "s1", "price": 100}, ...]
            
            for s_item in row["suppliers"]:
                s_name = s_item["name"]
                s_price = s_item["price"]
                
                # 查找或创建 Supplier
                s_stmt = select(Supplier).where(Supplier.supplier_name == s_name)
                supplier = await db.scalar(s_stmt)
                
                if not supplier:
                    supplier = Supplier(
                        supplier_name=s_name,
                        contact_info={},
                        remark="Imported from excel"
                    )
                    db.add(supplier)
                    await db.flush()
                    # Audit
                    db.add(AuditLog(
                        table_name="supplier",
                        record_id=supplier.id,
                        operation="CREATE",
                        diff_data={"supplier_name": s_name},
                        operator=user.username,
                        operated_at=now_china(),
                        source="import"
                    ))
                
                # 查找或创建 Binding (SupplierResource)
                sr_stmt = select(SupplierResource).where(
                    SupplierResource.supplier_id == supplier.id,
                    SupplierResource.resource_id == resource.id
                )
                sr = await db.scalar(sr_stmt)
                
                if sr:
                    # 已存在绑定，更新价格 (需求：合并)
                    if float(sr.settlement_price or 0) != s_price:
                        old_price = float(sr.settlement_price or 0)
                        sr.settlement_price = s_price
                        
                        # 记录价格变更历史? AuditLog
                        db.add(AuditLog(
                            table_name="supplier_resource",
                            record_id=sr.id,
                            operation="UPDATE",
                            diff_data={"before_price": old_price, "after_price": s_price},
                            operator=user.username,
                            operated_at=now_china(),
                            source="import"
                        ))
                else:
                    # 新增绑定
                    sr = SupplierResource(
                        supplier_id=supplier.id,
                        resource_id=resource.id,
                        settlement_price=s_price,
                        supply_status="active"
                    )
                    db.add(sr)
                    # Audit implicitly via not needed for join table usually? 
                    # But good to have
        
        await db.commit()
        return {
            "success": True, 
            "message": f"导入成功! 新增 {imported_count} 条, 更新 {updated_count} 条数据",
            "details": {"created": imported_count, "updated": updated_count}
        }
    
    except Exception as e:
        await db.rollback()
        # 捕捉具体行号已经在 parse_excel_data 中抛出的 ValueError 里包含了
        # 如果是数据库错误，尝试提取信息
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"导入处理失败: {str(e)}")

