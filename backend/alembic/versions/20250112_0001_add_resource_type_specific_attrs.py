"""add_resource_type_specific_attrs

为资源类型（门票、酒店等）添加特定字段支持
本迁移主要是文档性质的，因为attrs字段本身就是JSONB，无需修改表结构
但记录此次业务逻辑变更，便于追溯

Revision ID: 20250112_0001
Revises: 6dc6448cdff1
Create Date: 2026-01-12 14:57:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250112_0001'
down_revision = '048ed5796689'  # 最新的remove_status_columns迁移
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    添加资源类型特定属性支持
    
    Resource.attrs字段现在支持以下结构化内容：
    
    1. 门票（resource_type='门票'）：
       - ticket_type: 票种（成人票/儿童票/学生票/老人票/双人票）
       - address: 地址
       - entrance_times: 入园次数
       - age_limit: 年龄限制 {min, max}
       - includes: 门票包含内容
       - excludes: 门票不包含内容
       - earliest_entry_time: 最早入园时间
       - latest_entry_time: 最晚入园时间
       - advance_booking_days: 需提前预定天数
       - advance_booking_time: 需提前预定时间 {hours, minutes}
       - phone: 电话
       - description: 详细介绍
       - pickup_location: 取票地址
       - available_after_issue: 出票后多久可用
       - required_traveler_info: 所需出行人信息 ['身份证', '手机号', '姓名']
       - voucher_type: 凭证类型 ['身份证', '二维码', '手机号']
       - purchase_limit: 限购规则
       - refund_policy: 退票规则
       - additional_notes: 补充说明
    
    2. 酒店（resource_type='酒店'）：
       - room_type: 房型
       - bed_type: 床型
       - floor: 楼层
       - area: 面积
       - max_occupancy: 最大入住人数
       - amenities: 设施列表
       - breakfast_included: 是否含早餐
       - cancellation_policy: 取消政策
       - check_in_time: 入住时间
       - check_out_time: 退房时间
       - additional_notes: 补充说明
    
    对应的Schema定义在：app/schemas/resource_attrs.py
    """
    # 因为attrs已经是JSONB字段，无需修改表结构
    # 此迁移仅用于记录业务逻辑变更
    pass


def downgrade() -> None:
    """
    回退时无需操作，因为没有改变表结构
    """
    pass
