"""
POI类型特定属性的Schema定义
用于规范化Poi.attrs字段的JSONB内容
"""
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


class PoiBusinessContact(BaseModel):
    name: Optional[str] = Field(None, description="联系人")
    phone: Optional[str] = Field(None, description="电话")
    email: Optional[str] = Field(None, description="邮箱")
    position: Optional[str] = Field(None, description="职位")
    remark: Optional[str] = Field(None, description="备注")


# ==================== 景区POI通用属性 ====================
class TicketPoiAttrs(BaseModel):
    """景区POI的通用属性（所有该POI下的景区资源共享）"""
    
    
    # 业务对接人信息
    business_contacts: Optional[List[PoiBusinessContact]] = Field(None, description="业务对接人信息")

    scenic_category: Optional[str] = Field(None, description="景区类别")

    # 入园信息
    entrance_times: Optional[str] = Field(None, description="入园次数：unlimited或具体次数")
    earliest_entry_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="最早入园时间 HH:MM")
    latest_entry_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="最晚入园时间 HH:MM")
    entry_method: Optional[str] = Field(None, description="入园方式：刷身份证/扫码/人工检票等")
    
    # 联系与服务
    phone: Optional[str] = Field(None, description="联系电话")
    description: Optional[str] = Field(None, description="详细介绍")
    
    # 取票信息
    pickup_location: Optional[str] = Field(None, description="取票地址")
    pickup_method: Optional[str] = Field(None, description="取票方式：现场取票/电子票/快递等")
    
    # 游客信息要求
    required_traveler_info: Optional[List[Literal["身份证", "手机号", "姓名"]]] = Field(None, description="所需出行人信息")
    voucher_type: Optional[List[Literal["身份证", "二维码", "手机号"]]] = Field(None, description="凭证类型")
    
    # 限购与规则
    purchase_limit: Optional[str] = Field(None, description="限购规则")
    
    # 配套设施
    has_parking: Optional[bool] = Field(None, description="是否有停车场")
    parking_info: Optional[str] = Field(None, description="停车场信息：免费/收费/车位数等")
    transportation_info: Optional[str] = Field(None, description="园内交通信息：观光车/索道等")
    has_luggage_storage: Optional[bool] = Field(None, description="是否有行李寄存")
    toilet_info: Optional[str] = Field(None, description="卫生间信息：位置分布等")
    
    # 特色与说明
    highlights: Optional[str] = Field(None, description="景区亮点")
    invoice_info: Optional[str] = Field(None, description="发票说明")
    remark: Optional[str] = Field(None, description="备注")


# ==================== 酒店POI通用属性 ====================
class HotelPoiAttrs(BaseModel):
    """酒店POI的通用属性（所有该POI下的酒店房型资源共享）"""
    
    # 业务对接人信息
    business_contacts: Optional[List[PoiBusinessContact]] = Field(None, description="业务对接人信息")

    # 1. 酒店类型
    hotel_type: Optional[Literal["经济型", "舒适型", "高档型", "豪华型"]] = Field(None, description="酒店类型")
    
    # 2. 联系电话
    phone: Optional[str] = Field(None, description="联系电话")
    
    
    # 4. 酒店星级
    star_rating: Optional[Literal["五星", "四星", "三星", "二星", "无"]] = Field(None, description="酒店星级")

    # 携程星级
    ctrip_star_rating: Optional[Literal["一钻", "二钻", "三钻", "四钻", "五钻", "六钻"]] = Field(None, description="携程星级")

    # 网络/服务设施
    has_wifi: Optional[bool] = Field(None, description="是否有WIFI")
    has_wired_network: Optional[bool] = Field(None, description="是否有有线网络")
    has_concierge_service: Optional[bool] = Field(None, description="是否有礼宾服务")
    has_travel_ticket_service: Optional[bool] = Field(None, description="是否有旅游票务服务")
    has_wakeup_service: Optional[bool] = Field(None, description="是否有叫醒服务")
    has_room_service: Optional[bool] = Field(None, description="是否有送餐服务")
    has_elevator: Optional[bool] = Field(None, description="有无电梯")
    has_meeting_room: Optional[bool] = Field(None, description="有无会议厅")
    has_bar: Optional[bool] = Field(None, description="有无酒吧")
    has_atm: Optional[bool] = Field(None, description="有无自助取款机")
    has_fax_copy: Optional[bool] = Field(None, description="有无传真/复印机")
    has_ktv: Optional[bool] = Field(None, description="有无KTV")
    has_pool: Optional[bool] = Field(None, description="有无游泳池")
    has_gym: Optional[bool] = Field(None, description="有无健身房")
    has_chess_room: Optional[bool] = Field(None, description="有无棋牌室")
    has_tea_room: Optional[bool] = Field(None, description="有无茶室")
    has_billiards: Optional[bool] = Field(None, description="有无台球桌")
    has_sauna: Optional[bool] = Field(None, description="有无桑拿")
    has_massage: Optional[bool] = Field(None, description="有无按摩")
    has_beauty_hair: Optional[bool] = Field(None, description="有无理发美容中心")
    has_wedding_service: Optional[bool] = Field(None, description="有无婚宴服务")
    has_dry_cleaning: Optional[bool] = Field(None, description="有无干洗服务")
    has_laundry_room: Optional[bool] = Field(None, description="有无洗衣房")
    
    # 5. 取消/退款政策
    cancellation_policy: Optional[str] = Field(None, description="取消和退款政策")
    
    # 6. 限购政策
    purchase_limit: Optional[str] = Field(None, description="限购政策")
    
    # 7. 所需出行人信息
    required_traveler_info: Optional[List[Literal["身份证", "手机号", "姓名"]]] = Field(None, description="所需出行人信息")
    
    # 8. 详细介绍
    description: Optional[str] = Field(None, description="详细介绍")
    
    # 9. 最早入住时间
    check_in_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="最早入住时间 HH:MM")
    
    # 10. 最晚退房时间
    check_out_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="最晚退房时间 HH:MM")
    
    # 11. 停车场
    parking: Optional[Literal["无", "免费", "付费"]] = Field(None, description="停车场信息")
    
    # 设施服务 (12-15)
    has_pickup_service: Optional[bool] = Field(None, description="是否提供接机/接站服务")
    has_24h_reception: Optional[bool] = Field(None, description="是否24小时前台")
    has_luggage_storage: Optional[bool] = Field(None, description="是否可以寄存行李")
    has_restaurant: Optional[bool] = Field(None, description="是否有餐厅")
    
    # 16. 其他额外服务
    extra_services: Optional[str] = Field(None, description="其他人额外服务")
    
    # 17. 补充说明
    additional_notes: Optional[str] = Field(None, description="补充说明")


# ==================== 餐饮POI通用属性 ====================
class DiningPoiAttrs(BaseModel):
    """餐饮POI的通用属性"""
    
    # 业务对接人信息
    business_contacts: Optional[List[PoiBusinessContact]] = Field(None, description="业务对接人信息")

    # 1. 餐厅名称
    restaurant_name: Optional[str] = Field(None, description="餐厅名称")
    
    
    # 3. 停车场信息
    parking: Optional[str] = Field(None, description="停车场信息")
    
    # 4. 联系电话
    phone: Optional[str] = Field(None, description="联系电话")
    
    # 5. 详细介绍
    description: Optional[str] = Field(None, description="详细介绍")
    
    # 6. 营业开始时间
    opening_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="营业开始时间 HH:MM")
    
    # 7. 营业结束时间
    closing_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$", description="营业结束时间 HH:MM")


# ==================== 交通POI通用属性 ====================
class TransportPoiAttrs(BaseModel):
    """交通POI的通用属性（暂无特殊通用属性）"""
    business_contacts: Optional[List[PoiBusinessContact]] = Field(None, description="业务对接人信息")


# ==================== POI属性的联合类型 ====================
PoiAttrsUnion = TicketPoiAttrs | HotelPoiAttrs | DiningPoiAttrs | TransportPoiAttrs
