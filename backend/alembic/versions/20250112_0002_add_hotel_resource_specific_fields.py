"""add_hotel_resource_specific_fields

为酒店资源类型添加23个特定字段支持
本迁移主要是文档性质的，因为attrs字段本身就是JSONB，无需修改表结构
但记录此次业务逻辑变更，便于追溯

Revision ID: 20250112_0002
Revises: 20250112_0001
Create Date: 2026-01-12 15:23:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250112_0002'
down_revision = '20250112_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    添加酒店资源类型特定属性支持
    
    Resource.attrs字段现在支持以下酒店结构化内容（resource_type='酒店'）：
    
    1. room_type: 房型（标准/行政/豪华/套房）
    2. bed_type: 床型（大床/双床/亲子）
    3. hotel_type: 酒店类型（经济型/豪华型）
    4. phone: 电话
    5. address: 详细地址
    6. max_occupancy: 最大入住人数
    7. breakfast_included: 是否含早餐
    8. star_rating: 酒店星级（五星/四星/三星/无）
    9. cancellation_policy: 取消/退款政策
    10. purchase_limit: 限购规则
    11. required_traveler_info: 所需出行人信息 ['身份证', '手机号', '姓名']
    12. description: 详细介绍
    13. check_in_time: 最早入住时间
    14. check_out_time: 最晚退房时间
    15. advance_booking_days: 提前预定天数
    16. parking: 停车场（无/免费/付费）
    17. has_pickup_service: 有无接机/接站服务
    18. has_24h_reception: 是否24小时前台
    19. has_luggage_storage: 能否寄存行李
    20. has_restaurant: 有无餐厅
    21. extra_services: 其他额外服务
    22. area: 面积（平米）
    23. additional_notes: 补充说明
    
    对应的Schema定义在：app/schemas/resource_attrs.py (HotelAttrs)
    前端表单组件：frontend/src/components/HotelResourceFields.tsx
    
    审计日志：
    - 创建/更新酒店资源时，所有attrs字段变化都会被记录到audit_log表
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
