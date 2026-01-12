"""
资源类型特定属性的Schema定义
用于规范化Resource.attrs字段的JSONB内容
"""
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# ==================== 门票资源属性 ====================
class TicketAttrs(BaseModel):
    """门票资源的扩展属性"""
    
    # 票种
    ticket_type: Optional[Literal["成人票", "儿童票", "学生票", "老人票", "双人票"]] = None
    
    # 地址
    address: Optional[str] = None
    
    # 入园次数（"unlimited"表示无限进入，数字表示具体次数）
    entrance_times: Optional[str] = Field(None, description="无限进入或具体次数")
    
    # 年龄限制
    age_limit: Optional[dict] = Field(None, description="{'min': 0, 'max': 65}")
    
    # 门票包含内容
    includes: Optional[str] = Field(None, description="门票包含的内容")
    
    # 门票不包含内容
    excludes: Optional[str] = Field(None, description="门票不包含的内容")
    
    # 最早入园时间（格式：HH:MM）
    earliest_entry_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    
    # 最晚入园时间（格式：HH:MM）
    latest_entry_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    
    # 需提前预定天数
    advance_booking_days: Optional[int] = Field(None, ge=0, description="提前预定天数")
    
    # 需提前预定时间（小时和分钟）
    advance_booking_time: Optional[dict] = Field(None, description="{'hours': 0, 'minutes': 0}")
    
    # 电话
    phone: Optional[str] = None
    
    # 详细介绍
    description: Optional[str] = None
    
    # 取票地址
    pickup_location: Optional[str] = None
    
    # 出票后多久可用
    available_after_issue: Optional[str] = Field(None, description="例如：立即可用/24小时后可用")
    
    # 所需出行人信息（多选）
    required_traveler_info: Optional[List[Literal["身份证", "手机号", "姓名"]]] = None
    
    # 凭证类型（多选）
    voucher_type: Optional[List[Literal["身份证", "二维码", "手机号"]]] = None
    
    # 限购规则
    purchase_limit: Optional[str] = None
    
    # 退票规则
    refund_policy: Optional[str] = None
    
    # 游玩时间（小时）
    play_duration: Optional[float] = Field(None, ge=0, description="游玩时长（小时）")
    
    # 补充说明
    additional_notes: Optional[str] = None


# ==================== 酒店资源属性 ====================
class HotelAttrs(BaseModel):
    """酒店资源的扩展属性"""
    
    # 1. 房型
    room_type: Optional[Literal["标准", "行政", "豪华", "套房"]] = None
    
    # 2. 床型
    bed_type: Optional[Literal["大床", "双床", "亲子"]] = None
    
    # 3. 酒店类型
    hotel_type: Optional[Literal["经济型", "豪华型"]] = None
    
    # 4. 电话
    phone: Optional[str] = None
    
    # 5. 详细地址
    address: Optional[str] = Field(None, description="酒店详细地址")
    
    # 6. 最大入住人数
    max_occupancy: Optional[int] = Field(None, ge=1, description="最大入住人数")
    
    # 7. 是否含早餐
    breakfast_included: Optional[bool] = None
    
    # 8. 酒店星级
    star_rating: Optional[Literal["五星", "四星", "三星", "无"]] = None
    
    # 9. 取消/退款政策
    cancellation_policy: Optional[str] = Field(None, description="取消和退款政策")
    
    # 10. 限购规则
    purchase_limit: Optional[str] = None
    
    # 11. 所需出行人信息（多选）
    required_traveler_info: Optional[List[Literal["身份证", "手机号", "姓名"]]] = None
    
    # 12. 详细介绍
    description: Optional[str] = None
    
    # 13. 最早入住时间（格式：HH:MM）
    check_in_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="最早入住时间")
    
    # 14. 最晚退房时间（格式：HH:MM）
    check_out_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="最晚退房时间")
    
    # 15. 提前预定天数
    advance_booking_days: Optional[int] = Field(None, ge=0, description="需提前预定天数")
    
    # 16. 停车场
    parking: Optional[Literal["无", "免费", "付费"]] = None
    
    # 17. 有无接机/接站服务
    has_pickup_service: Optional[bool] = Field(None, description="是否提供接机/接站服务")
    
    # 18. 是否24小时前台
    has_24h_reception: Optional[bool] = Field(None, description="是否24小时前台")
    
    # 19. 能否寄存行李
    has_luggage_storage: Optional[bool] = Field(None, description="是否可以寄存行李")
    
    # 20. 有无餐厅
    has_restaurant: Optional[bool] = Field(None, description="是否有餐厅")
    
    # 21. 其他额外服务
    extra_services: Optional[str] = Field(None, description="其他额外服务")
    
    # 22. 面积（平米）
    area: Optional[float] = Field(None, ge=0, description="房间面积（平米）")
    
    # 23. 特殊结算规则
    special_settlement_rules: Optional[str] = Field(None, description="特殊结算规则")
    
    # 24. 补充说明
    additional_notes: Optional[str] = None


# ==================== 餐饮资源属性 ====================
class DiningAttrs(BaseModel):
    """餐饮资源的扩展属性"""
    
    # 1. 餐饮类型（多选）
    meal_types: Optional[List[Literal["早餐", "午餐", "晚餐"]]] = Field(None, description="餐饮类型（多选）")
    
    # 2. 正餐 or 小吃
    dining_category: Optional[Literal["正餐", "小吃"]] = None
    
    # 3. 餐厅名称
    restaurant_name: Optional[str] = Field(None, description="餐厅名称")
    
    # 4. 餐厅地址
    restaurant_address: Optional[str] = Field(None, description="餐厅地址")
    
    # 5. 电话
    phone: Optional[str] = None
    
    # 6. 餐厅营业时间（开始-结束）
    opening_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="营业开始时间")
    closing_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="营业结束时间")
    
    # 7. 是否需要预定
    reservation_required: Optional[bool] = Field(None, description="是否需要预定")
    
    # 8. 补充说明
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


# ==================== 通用资源属性（用于组合等其他类型）====================
class GenericAttrs(BaseModel):
    """通用资源属性，用于组合等其他类型"""
    
    # 通用备注字段
    notes: Optional[str] = None
    
    # 其他扩展字段（保持灵活性）
    extra: Optional[dict] = None


# ==================== 资源属性的联合类型 ====================
# 可以根据resource_type动态选择使用哪个Schema
ResourceAttrsUnion = TicketAttrs | HotelAttrs | DiningAttrs | TransportAttrs | GenericAttrs
