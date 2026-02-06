import { Descriptions, Tag, Empty, Divider } from 'antd'
import type { Resource, POI, ResourceCombinationMember } from '@/types'
import ContactTableDisplay from '@/components/ContactTableDisplay'

interface ResourceDetailsPanelProps {
    resource: Resource
    poi?: POI  // 可选的POI数据，用于显示通用字段
}

/**
 * 资源详情展示面板组件
 * 分两部分显示：
 * 1. POI通用字段（从poi.attrs读取）- 只有提供了poi数据时显示
 * 2. Resource独属字段（从resource.attrs读取）
 */
export default function ResourceDetailsPanel({ resource, poi }: ResourceDetailsPanelProps) {
    if (!resource) {
        return <Empty description="无子资源信息" />
    }

    const resourceAttrs: any = resource.attrs || {}
    const poiAttrs: any = poi?.attrs || {}
    const resourceType = resource.resource_type
    const businessContacts = Array.isArray(poiAttrs.business_contacts) ? poiAttrs.business_contacts : []
    const combinationMembers = Array.isArray(resource.combination_members) ? resource.combination_members : []

    const renderTagList = (labels: string[]) => {
        if (!labels.length) return '-'
        return labels.map((label) => (
            <Tag key={label} color="blue">{label}</Tag>
        ))
    }

    const renderCombinationMembers = (members: ResourceCombinationMember[]) => {
        if (!members.length) return '-'
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members.map((member) => (
                    <div
                        key={`${member.resource_id}-${member.resource_name}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <Tag color={member.is_combination ? 'purple' : 'blue'}>
                            {member.is_combination ? '组合' : member.resource_type}
                        </Tag>
                        <span>{member.resource_name}</span>
                    </div>
                ))}
            </div>
        )
    }

    // 渲染POI通用字段 (所有类型通用，但字段可能略有不同，这里显示最核心的)
    const renderPoiCommonAttrs = () => {
        if (!poi) return null

        const hotelFacilities = [
            poiAttrs.parking && poiAttrs.parking !== '无' ? `停车:${poiAttrs.parking}` : null,
            poiAttrs.has_wifi ? 'WIFI' : null,
            poiAttrs.has_wired_network ? '有线网络' : null,
            poiAttrs.has_concierge_service ? '礼宾服务' : null,
            poiAttrs.has_travel_ticket_service ? '旅游票务' : null,
            poiAttrs.has_wakeup_service ? '叫醒服务' : null,
            poiAttrs.has_room_service ? '送餐服务' : null,
            poiAttrs.has_elevator ? '电梯' : null,
            poiAttrs.has_meeting_room ? '会议厅' : null,
            poiAttrs.has_bar ? '酒吧' : null,
            poiAttrs.has_atm ? '自助取款机' : null,
            poiAttrs.has_fax_copy ? '传真/复印机' : null,
            poiAttrs.has_ktv ? 'KTV' : null,
            poiAttrs.has_pool ? '游泳池' : null,
            poiAttrs.has_gym ? '健身房' : null,
            poiAttrs.has_chess_room ? '棋牌室' : null,
            poiAttrs.has_tea_room ? '茶室' : null,
            poiAttrs.has_billiards ? '台球桌' : null,
            poiAttrs.has_sauna ? '桑拿' : null,
            poiAttrs.has_massage ? '按摩' : null,
            poiAttrs.has_beauty_hair ? '理发美容中心' : null,
            poiAttrs.has_wedding_service ? '婚宴服务' : null,
            poiAttrs.has_dry_cleaning ? '干洗服务' : null,
            poiAttrs.has_laundry_room ? '洗衣房' : null,
            poiAttrs.has_pickup_service ? '接机/站' : null,
            poiAttrs.has_24h_reception ? '24h前台' : null,
            poiAttrs.has_luggage_storage ? '行李寄存' : null,
            poiAttrs.has_restaurant ? '餐厅' : null,
        ].filter(Boolean) as string[]

        return (
            <>
                <Divider orientation="left" style={{ margin: '12px 0', fontSize: 14, color: '#666' }}>
                    🧭 资源通用信息 ({poi.poi_name})
                </Divider>
                <Descriptions bordered size="small" column={3}>
                    <Descriptions.Item label="资源编码">{poi.poi_code || '-'}</Descriptions.Item>
                    <Descriptions.Item label="城市">{poi.city}</Descriptions.Item>
                    <Descriptions.Item label="经度">{poi.longitude ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="纬度">{poi.latitude ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="地址" span={2}>{poi.address || '-'}</Descriptions.Item>
                    <Descriptions.Item label="业务对接人" span={3}>
                        <ContactTableDisplay
                            contacts={businessContacts}
                            showRemark
                            headerLabels={['姓名', '电话', '邮箱', '职位', '备注']}
                            emptyText="-"
                        />
                    </Descriptions.Item>

                    {/* 景区POI特定通用字段 */}
                    {resourceType === '景区' && (
                        <>
                            <Descriptions.Item label="景区类别">{poiAttrs.scenic_category || '-'}</Descriptions.Item>
                            <Descriptions.Item label="开放时间">{poiAttrs.open_time || '-'}</Descriptions.Item>
                            <Descriptions.Item label="联系电话">{poiAttrs.phone || '-'}</Descriptions.Item>
                            <Descriptions.Item label="取票地点">{poiAttrs.pickup_location || '-'}</Descriptions.Item>
                            <Descriptions.Item label="配套设施" span={3}>
                                {poiAttrs.facilities?.map((f: string) => (
                                    <Tag key={f} color="cyan">{f}</Tag>
                                )) || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="特色说明" span={3}>{poiAttrs.highlight || '-'}</Descriptions.Item>
                        </>
                    )}

                    {/* 酒店POI特定通用字段 */}
                    {resourceType === '酒店' && (
                        <>
                            <Descriptions.Item label="酒店类型">{poiAttrs.hotel_type || '-'}</Descriptions.Item>
                            <Descriptions.Item label="星级">{poiAttrs.star_rating || '-'}</Descriptions.Item>
                            <Descriptions.Item label="携程星级">{poiAttrs.ctrip_star_rating || '-'}</Descriptions.Item>
                            <Descriptions.Item label="联系电话">{poiAttrs.phone || '-'}</Descriptions.Item>
                            <Descriptions.Item label="入离时间">
                                {(poiAttrs.check_in_time || poiAttrs.check_out_time)
                                    ? `${poiAttrs.check_in_time || ''} - ${poiAttrs.check_out_time || ''}`
                                    : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="设施服务" span={3}>
                                {renderTagList(hotelFacilities)}
                            </Descriptions.Item>
                            <Descriptions.Item label="取消政策" span={3}>{poiAttrs.cancellation_policy || '-'}</Descriptions.Item>
                            <Descriptions.Item label="限购政策" span={3}>{poiAttrs.purchase_limit || '-'}</Descriptions.Item>
                            <Descriptions.Item label="详细介绍" span={3}>{poiAttrs.description || '-'}</Descriptions.Item>
                        </>
                    )}

                    {/* 餐饮POI特定通用字段 */}
                    {resourceType === '餐饮' && (
                        <>
                            <Descriptions.Item label="餐厅名称">{poiAttrs.restaurant_name || '-'}</Descriptions.Item>
                            <Descriptions.Item label="联系电话">{poiAttrs.phone || '-'}</Descriptions.Item>
                            <Descriptions.Item label="营业时间">
                                {(poiAttrs.opening_time && poiAttrs.closing_time)
                                    ? `${poiAttrs.opening_time} - ${poiAttrs.closing_time}`
                                    : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="停车场">{poiAttrs.parking || '-'}</Descriptions.Item>
                            <Descriptions.Item label="详细介绍" span={2}>{poiAttrs.description || '-'}</Descriptions.Item>
                        </>
                    )}

                    {/* 其他类型暂无特定通用展示逻辑，仅回退 */}
                    {resourceType !== '景区' && resourceType !== '酒店' && resourceType !== '餐饮' && (
                        <Descriptions.Item label="联系电话">{poiAttrs.phone || '-'}</Descriptions.Item>
                    )}
                </Descriptions>
            </>
        )
    }

    // 渲染景区特定字段（资源独属）
    const renderTicketResourceAttrs = () => (
        <>
            <Descriptions.Item label="票种">{resourceAttrs.ticket_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="年龄限制">
                {resourceAttrs.age_limit ? `${resourceAttrs.age_limit.min}岁 - ${resourceAttrs.age_limit.max}岁` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="身高限制">
                {resourceAttrs.height_limit ? `${resourceAttrs.height_limit.min}cm - ${resourceAttrs.height_limit.max}cm` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="提前预定天数">{resourceAttrs.advance_booking_days ? `${resourceAttrs.advance_booking_days}天` : '-'}</Descriptions.Item>
            <Descriptions.Item label="提前预定时间">
                {resourceAttrs.advance_booking_time
                    ? `${resourceAttrs.advance_booking_time.hours || 0}小时${resourceAttrs.advance_booking_time.minutes || 0}分钟`
                    : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="出票后可用时间">{resourceAttrs.available_after_issue || '-'}</Descriptions.Item>
            <Descriptions.Item label="包含内容" span={3}>{resourceAttrs.includes || '-'}</Descriptions.Item>
            <Descriptions.Item label="不包含内容" span={3}>{resourceAttrs.excludes || '-'}</Descriptions.Item>
            <Descriptions.Item label="退票规则" span={3}>{resourceAttrs.refund_policy || '-'}</Descriptions.Item>
            <Descriptions.Item label="建议游玩时间">
                {resourceAttrs.play_duration ? `${resourceAttrs.play_duration}小时` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="需要出行人信息">
                {resourceAttrs.required_traveler_info?.map((info: string) => (
                    <Tag key={info} color="blue">{info}</Tag>
                )) || '-'}
            </Descriptions.Item>
        </>
    )

    // 渲染酒店特定字段 (资源独属)
    const renderHotelAttrs = () => (
        <>
            <Descriptions.Item label="房型">{resourceAttrs.room_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="床型">{resourceAttrs.bed_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="最大入住">{resourceAttrs.max_occupancy ? `${resourceAttrs.max_occupancy}人` : '-'}</Descriptions.Item>
            <Descriptions.Item label="面积">{resourceAttrs.area ? `${resourceAttrs.area}㎡` : '-'}</Descriptions.Item>
            <Descriptions.Item label="含早餐">{resourceAttrs.breakfast_included === true ? '是' : (resourceAttrs.breakfast_included === false ? '否' : '-')}</Descriptions.Item>
            <Descriptions.Item label="有窗">{resourceAttrs.has_window === true ? '有' : (resourceAttrs.has_window === false ? '无' : '-')}</Descriptions.Item>
            <Descriptions.Item label="提前预定">{resourceAttrs.advance_booking_days ? `${resourceAttrs.advance_booking_days}天` : '-'}</Descriptions.Item>
            <Descriptions.Item label="房间配套" span={2}>
                {Array.isArray(resourceAttrs.room_facilities)
                    ? resourceAttrs.room_facilities.map((f: string) => <Tag key={f}>{f}</Tag>)
                    : (resourceAttrs.room_facilities || '-')}
            </Descriptions.Item>
        </>
    )

    // 渲染餐饮特定字段
    const renderDiningAttrs = () => (
        <>
            <Descriptions.Item label="餐饮类型">
                {resourceAttrs.meal_types?.map((type: string) => (
                    <Tag key={type} color="green">{type}</Tag>
                )) || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="餐饮分类">{resourceAttrs.dining_category || '-'}</Descriptions.Item>
            <Descriptions.Item label="需要预定">{resourceAttrs.reservation_required ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="适配人数">{resourceAttrs.suitable_for_people ? `${resourceAttrs.suitable_for_people}人` : '-'}</Descriptions.Item>
            <Descriptions.Item label="包含内容" span={3}>{resourceAttrs.includes_details || '-'}</Descriptions.Item>
        </>
    )

    // 渲染交通特定字段
    const renderTransportAttrs = () => (
        <>
            <Descriptions.Item label="交通类型">{resourceAttrs.transport_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="起点">{resourceAttrs.departure || '-'}</Descriptions.Item>
            <Descriptions.Item label="终点">{resourceAttrs.destination || '-'}</Descriptions.Item>
            <Descriptions.Item label="最大座位数">{resourceAttrs.max_seats ? `${resourceAttrs.max_seats}座` : '-'}</Descriptions.Item>
            <Descriptions.Item label="行程时长" span={2}>{resourceAttrs.duration || '-'}</Descriptions.Item>
        </>
    )

    return (
        <div style={{ marginTop: 16 }}>
            {/* 第一部分：POI通用信息 */}
            {renderPoiCommonAttrs()}

            {/* 第二部分：子资源基本信息 */}
            <Divider orientation="left" style={{ margin: '12px 0 12px 0', fontSize: 14, color: '#666' }}>
                🏷️ 子资源基本信息
            </Divider>
            <Descriptions bordered size="small" column={3}>
                <Descriptions.Item label="子资源名称">{resource.resource_name}</Descriptions.Item>
                <Descriptions.Item label="子资源编码">{resource.resource_code || '-'}</Descriptions.Item>
                <Descriptions.Item label="子资源类型">
                    <Tag color="blue">{resourceType}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="组合资源">
                    {resource.is_combination ? <Tag color="purple">是</Tag> : '否'}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                    <Tag color={resource.status === 'active' ? 'green' : 'default'}>
                        {resource.status === 'active' ? '启用' : '停用'}
                    </Tag>
                </Descriptions.Item>
            </Descriptions>

            {resource.is_combination && (
                <>
                    <Divider orientation="left" style={{ margin: '12px 0', fontSize: 14, color: '#666' }}>
                        组合成员
                    </Divider>
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="成员资源">
                            {renderCombinationMembers(combinationMembers)}
                        </Descriptions.Item>
                    </Descriptions>
                </>
            )}

            {/* 第三部分：子资源独属详细信息 */}
            {!resource.is_combination && (resourceType === '景区' || resourceType === '酒店' || resourceType === '餐饮' || resourceType === '交通') && (
                <>
                    <Divider orientation="left" style={{ margin: '12px 0', fontSize: 14, color: '#666' }}>
                        📑 {resourceType}独属信息
                    </Divider>
                    <Descriptions bordered size="small" column={3}>
                        {resourceType === '景区' && renderTicketResourceAttrs()}
                        {resourceType === '酒店' && renderHotelAttrs()}
                        {resourceType === '餐饮' && renderDiningAttrs()}
                        {resourceType === '交通' && renderTransportAttrs()}

                        {resourceAttrs.additional_notes && (
                            <Descriptions.Item label="补充说明" span={3}>{resourceAttrs.additional_notes}</Descriptions.Item>
                        )}
                        {resourceAttrs.description && (
                            <Descriptions.Item label="详细介绍" span={3}>{resourceAttrs.description}</Descriptions.Item>
                        )}
                    </Descriptions>
                </>
            )}
        </div>
    )
}
