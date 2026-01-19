"""
数据迁移脚本：将Resource.attrs中的通用字段迁移到POI.attrs

运行方式：
    cd backend
    python scripts/migrate_resource_attrs_to_poi.py

注意：
1. 运行前请确保已执行数据库迁移（alembic upgrade head）
2. 建议先在测试环境运行
3. 运行前请备份数据库
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, func
from app.core.database import SessionLocal
from app.models import Poi, Resource

# 门票类型：需要从Resource.attrs迁移到POI.attrs的通用字段
TICKET_COMMON_FIELDS = [
    'address',              # 详细地址
    'entrance_times',       # 入园次数
    'earliest_entry_time',  # 最早入园时间
    'latest_entry_time',    # 最晚入园时间
    'phone',                # 联系电话
    'description',          # 详细介绍
    'pickup_location',      # 取票地址
    'required_traveler_info',  # 所需出行人信息
    'voucher_type',         # 凭证类型
    'purchase_limit',       # 限购规则
]

# Resource.attrs保留的独属字段
TICKET_RESOURCE_FIELDS = [
    'ticket_type',           # 票种
    'age_limit',             # 年龄限制
    'height_limit',          # 身高限制（新增）
    'advance_booking_days',  # 提前预定天数
    'advance_booking_time',  # 提前预定时间
    'includes',              # 包含内容
    'excludes',              # 不包含内容
    'available_after_issue', # 出票后可用时间
    'refund_policy',         # 退票规则
    'play_duration',         # 游玩时间
    'additional_notes',      # 补充说明
]


async def migrate_ticket_poi():
    """迁移门票类型的POI和Resource"""
    async with SessionLocal() as db:
        print("=" * 70)
        print("开始迁移门票类型的通用字段...")
        print("=" * 70)
        
        # 查找所有门票类型的POI
        stmt = select(Poi).where(Poi.poi_type == '门票')
        result = await db.execute(stmt)
        ticket_pois = result.scalars().all()
        
        if not ticket_pois:
            print("⚠️  没有找到门票类型的POI，跳过迁移")
            return
        
        print(f"\n找到 {len(ticket_pois)} 个门票类型的POI")
        
        migrated_poi_count = 0
        migrated_resource_count = 0
        skipped_count = 0
        
        for poi in ticket_pois:
            print(f"\n{'─' * 70}")
            print(f"处理POI: {poi.poi_name} (ID: {poi.id}, 城市: {poi.city})")
            
            # 获取该POI下的所有资源
            resource_stmt = select(Resource).where(Resource.poi_id == poi.id)
            resource_result = await db.execute(resource_stmt)
            resources = resource_result.scalars().all()
            
            if not resources:
                print(f"  ⚠️  警告: 该POI下没有资源，跳过")
                skipped_count += 1
                continue
            
            print(f"  找到 {len(resources)} 个关联资源")
            
            # 使用第一个有attrs的资源作为POI通用字段的来源
            source_resource = None
            for resource in resources:
                if resource.attrs:
                    source_resource = resource
                    break
            
            if not source_resource or not source_resource.attrs:
                print(f"  ⚠️  跳过: 所有资源都没有attrs字段")
                skipped_count += 1
                continue
            
            # 提取通用字段到POI.attrs
            poi_attrs = {}
            for field in TICKET_COMMON_FIELDS:
                if field in source_resource.attrs:
                    poi_attrs[field] = source_resource.attrs[field]
            
            if poi_attrs:
                # 如果POI已有attrs，合并而不是覆盖
                if poi.attrs:
                    print(f"  ⚠️  POI已有attrs字段，将合并数据")
                    poi.attrs.update(poi_attrs)
                else:
                    poi.attrs = poi_attrs
                
                migrated_poi_count += 1
                print(f"  ✅ 迁移了 {len(poi_attrs)} 个通用字段到POI.attrs")
                print(f"     字段: {', '.join(poi_attrs.keys())}")
            else:
                print(f"  ℹ️  没有通用字段需要迁移")
            
            # 清理所有资源的通用字段，只保留独属字段
            for resource in resources:
                if not resource.attrs:
                    continue
                
                # 创建新的attrs，只保留独属字段
                new_attrs = {}
                removed_fields = []
                
                for key, value in resource.attrs.items():
                    if key in TICKET_RESOURCE_FIELDS:
                        # 保留资源独属字段
                        new_attrs[key] = value
                    elif key in TICKET_COMMON_FIELDS:
                        # 移除通用字段（已迁移到POI）
                        removed_fields.append(key)
                    else:
                        # 未知字段，保留并警告
                        print(f"  ⚠️  警告: 资源 '{resource.resource_name}' 有未知字段 '{key}'，已保留")
                        new_attrs[key] = value
                
                resource.attrs = new_attrs if new_attrs else None
                migrated_resource_count += 1
                
                if removed_fields:
                    print(f"  ✅ 清理资源 '{resource.resource_name}' 的 {len(removed_fields)} 个通用字段")
        
        # 确认是否提交
        print(f"\n{'=' * 70}")
        print("迁移预览完成，准备提交更改...")
        print(f"  - 将更新 {migrated_poi_count} 个POI的attrs")
        print(f"  - 将清理 {migrated_resource_count} 个Resource的通用字段")
        print(f"  - 跳过了 {skipped_count} 个POI（无资源或无attrs）")
        print("=" * 70)
        
        # 提交更改
        await db.commit()
        
        print("\n✅ 迁移成功提交到数据库！")
        print(f"\n{'=' * 70}")
        print("迁移总结:")
        print(f"  ✅ 成功迁移的POI: {migrated_poi_count}")
        print(f"  ✅ 成功清理的Resource: {migrated_resource_count}")
        print(f"  ⏭️  跳过的POI: {skipped_count}")
        print("=" * 70)


async def verify_migration():
    """验证迁移结果"""
    async with SessionLocal() as db:
        print("\n" + "=" * 70)
        print("验证迁移结果...")
        print("=" * 70)
        
        # 检查POI
        poi_stmt = select(Poi).where(Poi.poi_type == '门票')
        pois = (await db.execute(poi_stmt)).scalars().all()
        
        print(f"\n📊 门票POI统计:")
        print(f"  - 总数: {len(pois)}")
        
        pois_with_attrs = sum(1 for p in pois if p.attrs)
        print(f"  - 有attrs的POI: {pois_with_attrs}")
        
        # 显示前3个POI的详情
        print(f"\n前3个POI示例:")
        for poi in pois[:3]:
            print(f"\n  POI: {poi.poi_name}")
            print(f"    poi_type: {poi.poi_type}")
            if poi.attrs:
                print(f"    attrs字段数: {len(poi.attrs)}")
                print(f"    attrs字段: {', '.join(poi.attrs.keys())}")
            else:
                print(f"    attrs: None")
        
        # 检查Resource
        resource_stmt = select(Resource).where(Resource.resource_type == '门票')
        resources = (await db.execute(resource_stmt)).scalars().all()
        
        print(f"\n📊 门票Resource统计:")
        print(f"  - 总数: {len(resources)}")
        
        resources_with_attrs = sum(1 for r in resources if r.attrs)
        print(f"  - 有attrs的Resource: {resources_with_attrs}")
        
        # 显示前3个Resource的详情
        print(f"\n前3个Resource示例:")
        for res in resources[:3]:
            print(f"\n  Resource: {res.resource_name}")
            print(f"    resource_type: {res.resource_type}")
            if res.attrs:
                print(f"    attrs字段数: {len(res.attrs)}")
                print(f"    attrs字段: {', '.join(res.attrs.keys())}")
            else:
                print(f"    attrs: None")
        
        print("\n" + "=" * 70)


async def main():
    """主函数"""
    print("\n🚀 资源中心数据迁移工具")
    print("=" * 70)
    
    try:
        # 执行迁移
        await migrate_ticket_poi()
        
        # 验证结果
        await verify_migration()
        
        print("\n✅ 所有操作完成！")
        
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        print("\n⚠️  迁移失败，数据库未提交更改")


if __name__ == "__main__":
    asyncio.run(main())
