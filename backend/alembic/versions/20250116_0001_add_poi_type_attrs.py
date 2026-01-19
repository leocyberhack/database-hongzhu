"""add poi_type and attrs to poi table

Revision ID: 20250116_0001
Revises: 最新的revision ID（需要查看alembic/versions目录确定）
Create Date: 2026-01-16 14:06:00.000000

重构说明：
1. POI表新增 poi_type 字段（酒店/门票/餐饮/交通，必选）
2. POI表新增 attrs 字段（JSONB，存储POI类型的通用字段）
3. Resource表的 resource_type 将自动继承POI的 poi_type（应用层实现）
4. Resource表的 attrs 只存储资源独属字段

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision = '20250116_0001_add_poi_type_attrs'
down_revision = '20250112_0004'  # 当前最新的revision
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 使用 execute 检查列是否已存在，实现幂等迁移
    conn = op.get_bind()
    
    # 检查 poi_type 列是否存在
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'poi' AND column_name = 'poi_type'
    """))
    if result.fetchone() is None:
        op.add_column('poi', sa.Column('poi_type', sa.String(), nullable=True))
    
    # 检查 attrs 列是否存在
    result = conn.execute(sa.text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'poi' AND column_name = 'attrs'
    """))
    if result.fetchone() is None:
        op.add_column('poi', sa.Column('attrs', JSONB, nullable=True))
    
    # 3. 为现有数据设置默认 poi_type
    # 策略：根据现有Resource的resource_type推断POI类型
    # 如果POI下有多种资源类型，取第一个资源的类型
    # 如果POI下没有资源，设置为 '其他'
    
    op.execute("""
        UPDATE poi 
        SET poi_type = COALESCE(
            (
                SELECT resource.resource_type 
                FROM resource 
                WHERE resource.poi_id = poi.id 
                LIMIT 1
            ),
            '其他'
        )
    """)
    
    # 4. 将 poi_type 设置为 NOT NULL
    op.alter_column('poi', 'poi_type', nullable=False)
    
    # 5. 创建索引以提高查询性能
    op.create_index('ix_poi_poi_type', 'poi', ['poi_type'])
    
    print("✅ 迁移完成：POI表已添加 poi_type 和 attrs 字段")
    print("⚠️  注意：需要手动迁移现有Resource.attrs中的通用字段到POI.attrs")
    print("   建议使用数据迁移脚本处理现有数据")


def downgrade() -> None:
    # 删除索引
    op.drop_index('ix_poi_poi_type', table_name='poi')
    
    # 删除列
    op.drop_column('poi', 'attrs')
    op.drop_column('poi', 'poi_type')
    
    print("✅ 回滚完成：已移除 POI 的 poi_type 和 attrs 字段")
