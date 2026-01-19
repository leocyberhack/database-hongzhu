"""
资源类型特定属性的Schema定义
用于规范化Resource.attrs字段的JSONB内容
"""
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# ==================== 门票资源属性（资源独属字段）====================
class TicketAttrs(BaseModel):
    """门票资源的独属属性（POI层已定义通用字段）"""
    
    # 票种
    ticket_type: Optional[Literal["成人票", "儿童票", "学生票", "老人票", "双人票", "家庭票", "团体票"]] = Field(None, description="票种类型")
    
    # 年龄限制（岁）
    age_limit: Optional[dict] = Field(None, description="年龄限制 {'min': 0, 'max': 65}")
    
    # 身高限制（厘米）
    height_limit: Optional[dict] = Field(None, description="身高限制 {'min': 100, 'max': 200}")
    
    # 需提前预定天数
    advance_booking_days: Optional[int] = Field(None, ge=0, description="提前预定天数")
    
    # 需提前预定时间（小时和分钟）
    advance_booking_time: Optional[dict] = Field(None, description="提前预定时间 {'hours': 2, 'minutes': 30}")
    
    # 门票包含内容
    includes: Optional[str] = Field(None, description="门票包含的内容")
    
    # 门票不包含内容
    excludes: Optional[str] = Field(None, description="门票不包含的内容")
    
    # 出票后多久可用
    available_after_issue: Optional[str] = Field(None, description="例如：立即可用/24小时后可用")
    
    # 退票规则
    refund_policy: Optional[str] = Field(None, description="退票规则说明")
    
    # 游玩时间（小时）
    play_duration: Optional[float] = Field(None, ge=0, description="建议游玩时长（小时）")
    
    # 补充说明
    additional_notes: Optional[str] = Field(None, description="资源级别的补充说明")


# ==================== 酒店资源属性 ====================
# ==================== 酒店资源属性 ====================
class HotelAttrs(BaseModel):
    """酒店资源的独属属性（POI层已定义通用字段）"""
    
    # 1. 房型
    room_type: Optional[Literal["标准", "行政", "豪华", "套房", "大床房", "双床房", "家庭房"]] = Field(None, description="房型")
    
    # 2. 床型
    bed_type: Optional[Literal["大床", "双床", "单人床", "多张床"]] = Field(None, description="床型")
    
    # 3. 最大入住人数
    max_occupancy: Optional[int] = Field(None, ge=1, description="最大入住人数")
    
    # 4. 是否含早餐
    breakfast_included: Optional[bool] = Field(None, description="是否含早餐")
    
    # 5. 面积（平米）
    area: Optional[float] = Field(None, ge=0, description="房间面积（平米）")
    
    # 6. 提前预定天数
    advance_booking_days: Optional[int] = Field(None, ge=0, description="需提前预定天数")
    
    # 7. 有无窗户
    has_window: Optional[bool] = Field(None, description="是否有窗户")
    
    # 8. 房间配套设施
    room_facilities: Optional[List[str]] = Field(None, description="房间配套设施，如Wifi、吹风机等")
    
    # 9. 备注 (对应原additional_notes，用户称之为备注)
    additional_notes: Optional[str] = Field(None, description="备注")


# ==================== 餐饮资源属性 ====================
class DiningAttrs(BaseModel):
    """餐饮资源的独属属性（POI层已定义通用字段）"""
    
    # 1. 餐饮类型（多选）
    meal_types: Optional[List[Literal["早餐", "午餐", "晚餐"]]] = Field(None, description="餐饮类型（多选）")
    
    # 2. 餐饮分类
    dining_category: Optional[Literal["正餐", "小吃"]] = None
    
    # 3. 包含内容详情
    includes_details: Optional[str] = Field(None, description="包含内容详情")
    
    # 4. 是否需要预定
    reservation_required: Optional[bool] = Field(None, description="是否需要预定")
    
    # 5. 适配人数
    suitable_for_people: Optional[int] = Field(None, ge=1, description="适配人数")
    
    # 6. 补充说明
    additional_notes: Optional[str] = None


# ==================== 交通资源属性 ====================
class TransportAttrs(BaseModel):
    """交通资源的扩展属性"""
    
    # 1. 交通类型
    transport_type: Optional[Literal["大巴", "商务车", "轿车"]] = None
    
    # 2. 起点
    departure: Optional[str] = Field(None, description="起点")
    
    # 3. 终点
    destination: Optional[str] = Field(None, description="终点")
    
    # 4. 最大座位数
    max_seats: Optional[int] = Field(None, ge=1, description="最大座位数")
    
    # 5. 行程时长
    duration: Optional[str] = Field(None, description="行程时长，例如：2小时30分钟")
    
    # 6. 补充说明
    additional_notes: Optional[str] = None


# ==================== 资源属性的联合类型 ====================
# 可以根据resource_type动态选择使用哪个Schema
ResourceAttrsUnion = TicketAttrs | HotelAttrs | DiningAttrs | TransportAttrs
