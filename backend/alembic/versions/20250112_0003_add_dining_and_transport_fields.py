"""add_dining_and_transport_resource_fields

为餐饮和交通资源类型添加特定字段支持
本迁移主要是文档性质的，因为attrs字段本身就是JSONB，无需修改表结构
但记录此次业务逻辑变更，便于追溯

Revision ID: 20250112_0003
Revises: 20250112_0002
Create Date: 2026-01-12 15:50:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250112_0003'
down_revision = '20250112_0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    添加餐饮和交通资源类型特定属性支持
    
    === 餐饮资源（resource_type='餐饮'）===
    Resource.attrs字段支持以下结构化内容：
    
    1. meal_types: 餐饮类型（多选）['早餐', '午餐', '晚餐']
    2. dining_category: 餐饮分类（正餐/小吃）
    3. restaurant_name: 餐厅名称
    4. restaurant_address: 餐厅地址
    5. phone: 电话
    6. opening_time: 营业开始时间（HH:MM格式）
    7. closing_time: 营业结束时间（HH:MM格式）
    8. reservation_required: 是否需要预定（布尔值）
    9. additional_notes: 补充说明
    
    === 交通资源（resource_type='交通'）===
    Resource.attrs字段支持以下结构化内容：
    
    1. transport_type: 交通类型（大巴/商务车/轿车）
    2. departure: 起点
    3. destination: 终点
    4. max_seats: 最大座位数
    5. duration: 行程时长（如"2小时30分钟"）
    6. additional_notes: 补充说明
    
    对应的Schema定义在：
    - app/schemas/resource_attrs.py (DiningAttrs, TransportAttrs)
    
    前端表单组件：
    - frontend/src/components/DiningResourceFields.tsx
    - frontend/src/components/TransportResourceFields.tsx
    
    审计日志：
    - 创建/更新餐饮或交通资源时，所有attrs字段变化都会被记录到audit_log表
    - 操作类型：CREATE/UPDATE
    - diff_data字段包含完整的before/after数据
    """
    # 因为attrs已经是JSONB字段，无需修改表结构
    # 此迁移仅用于记录业务逻辑变更
    pass


def downgrade() -> None:
    """
    回退时无需操作，因为没有改变表结构
    """
    pass
