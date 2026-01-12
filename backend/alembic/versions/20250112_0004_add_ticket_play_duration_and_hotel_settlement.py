"""add_ticket_play_duration_and_hotel_settlement_rules

为门票和酒店资源类型各添加一个非必填字段
- 门票：游玩时间（小时）
- 酒店：特殊结算规则

本迁移主要是文档性质的，因为attrs字段本身就是JSONB，无需修改表结构
但记录此次业务逻辑变更，便于追溯

Revision ID: 20250112_0004
Revises: 20250112_0003
Create Date: 2026-01-12 15:58:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250112_0004'
down_revision = '20250112_0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    为门票和酒店资源类型添加新字段
    
    === 门票资源（resource_type='门票'）===
    新增字段：
    - play_duration: 游玩时间（小时）- 浮点数，非必填
      用于记录游玩建议时长，例如：2.5 表示2.5小时
    
    === 酒店资源（resource_type='酒店'）===
    新增字段：
    - special_settlement_rules: 特殊结算规则 - 字符串，非必填
      用于记录该酒店资源的特殊结算说明
    
    对应的Schema定义在：
    - app/schemas/resource_attrs.py (TicketAttrs.play_duration, HotelAttrs.special_settlement_rules)
    
    前端表单组件已更新：
    - frontend/src/components/TicketResourceFields.tsx (添加游玩时间字段)
    - frontend/src/components/HotelResourceFields.tsx (添加特殊结算规则字段)
    
    审计日志：
    - 所有attrs字段变化会自动记录到audit_log表
    - 包括新增的play_duration和special_settlement_rules字段
    """
    # 因为attrs已经是JSONB字段，无需修改表结构
    # 此迁移仅用于记录业务逻辑变更
    pass


def downgrade() -> None:
    """
    回退时无需操作，因为没有改变表结构
    """
    pass
