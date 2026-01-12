import { Descriptions, Tag, Empty, Divider } from 'antd'
import type { Resource } from '@/types'

interface ResourceDetailsPanelProps {
    resource: Resource
}

/**
 * 资源详情展示面板组件
 * 根据资源类型显示对应的attrs字段详情
 */
export default function ResourceDetailsPanel({ resource }: ResourceDetailsPanelProps) {
    if (!resource) {
        return <Empty description="无资源信息" />
    }

    const attrs: any = resource.attrs || {}
    const resourceType = resource.resource_type

    // 渲染门票特定字段
    const renderTicketAttrs = () => (
        <>
            <Descriptions.Item label="票种">{attrs.ticket_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址">{attrs.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="入园次数">{attrs.entrance_times || '-'}</Descriptions.Item>
            <Descriptions.Item label="年龄限制">
                {attrs.age_limit ? `${attrs.age_limit.min}岁 - ${attrs.age_limit.max}岁` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="入园时间">
                {attrs.earliest_entry_time && attrs.latest_entry_time
                    ? `${attrs.earliest_entry_time} - ${attrs.latest_entry_time}`
                    : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="游玩时间">
                {attrs.play_duration ? `${attrs.play_duration}小时` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="提前预定">{attrs.advance_booking_days ? `${attrs.advance_booking_days}天` : '-'}</Descriptions.Item>
            <Descriptions.Item label="取票地址">{attrs.pickup_location || '-'}</Descriptions.Item>
            <Descriptions.Item label="电话">{attrs.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="包含内容" span={3}>{attrs.includes || '-'}</Descriptions.Item>
            <Descriptions.Item label="不包含内容" span={3}>{attrs.excludes || '-'}</Descriptions.Item>
            <Descriptions.Item label="所需出行人信息" span={2}>
                {attrs.required_traveler_info?.map((info: string) => (
                    <Tag key={info} color="blue">{info}</Tag>
                )) || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="凭证类型">
                {attrs.voucher_type?.map((type: string) => (
                    <Tag key={type} color="green">{type}</Tag>
                )) || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="限购规则" span={2}>{attrs.purchase_limit || '-'}</Descriptions.Item>
            <Descriptions.Item label="退票规则" span={3}>{attrs.refund_policy || '-'}</Descriptions.Item>
        </>
    )

    // 渲染酒店特定字段
    const renderHotelAttrs = () => (
        <>
            <Descriptions.Item label="房型">{attrs.room_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="床型">{attrs.bed_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="酒店类型">{attrs.hotel_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="酒店星级">{attrs.star_rating || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{attrs.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="最大入住人数">{attrs.max_occupancy ? `${attrs.max_occupancy}人` : '-'}</Descriptions.Item>
            <Descriptions.Item label="含早餐">{attrs.breakfast_included ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="面积">{attrs.area ? `${attrs.area}㎡` : '-'}</Descriptions.Item>
            <Descriptions.Item label="入住/退房时间">
                {attrs.check_in_time && attrs.check_out_time
                    ? `${attrs.check_in_time} / ${attrs.check_out_time}`
                    : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="提前预定">{attrs.advance_booking_days ? `${attrs.advance_booking_days}天` : '-'}</Descriptions.Item>
            <Descriptions.Item label="停车场">{attrs.parking || '-'}</Descriptions.Item>
            <Descriptions.Item label="电话">{attrs.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="服务设施" span={3}>
                {attrs.has_pickup_service && <Tag color="blue">接机服务</Tag>}
                {attrs.has_24h_reception && <Tag color="cyan">24小时前台</Tag>}
                {attrs.has_luggage_storage && <Tag color="green">行李寄存</Tag>}
                {attrs.has_restaurant && <Tag color="orange">餐厅</Tag>}
                {!attrs.has_pickup_service && !attrs.has_24h_reception && !attrs.has_luggage_storage && !attrs.has_restaurant && '-'}
            </Descriptions.Item>
            <Descriptions.Item label="所需出行人信息" span={2}>
                {attrs.required_traveler_info?.map((info: string) => (
                    <Tag key={info} color="blue">{info}</Tag>
                )) || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="限购规则" span={2}>{attrs.purchase_limit || '-'}</Descriptions.Item>
            <Descriptions.Item label="取消政策" span={3}>{attrs.cancellation_policy || '-'}</Descriptions.Item>
            <Descriptions.Item label="特殊结算规则" span={3}>{attrs.special_settlement_rules || '-'}</Descriptions.Item>
            <Descriptions.Item label="额外服务" span={3}>{attrs.extra_services || '-'}</Descriptions.Item>
        </>
    )

    // 渲染餐饮特定字段
    const renderDiningAttrs = () => (
        <>
            <Descriptions.Item label="餐饮类型">
                {attrs.meal_types?.map((type: string) => (
                    <Tag key={type} color="green">{type}</Tag>
                )) || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="餐饮分类">{attrs.dining_category || '-'}</Descriptions.Item>
            <Descriptions.Item label="餐厅名称">{attrs.restaurant_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="餐厅地址" span={2}>{attrs.restaurant_address || '-'}</Descriptions.Item>
            <Descriptions.Item label="电话">{attrs.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="营业时间">
                {attrs.opening_time && attrs.closing_time
                    ? `${attrs.opening_time} - ${attrs.closing_time}`
                    : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="需要预定">{attrs.reservation_required ? '是' : '否'}</Descriptions.Item>
        </>
    )

    // 渲染交通特定字段
    const renderTransportAttrs = () => (
        <>
            <Descriptions.Item label="交通类型">{attrs.transport_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="起点">{attrs.departure || '-'}</Descriptions.Item>
            <Descriptions.Item label="终点">{attrs.destination || '-'}</Descriptions.Item>
            <Descriptions.Item label="最大座位数">{attrs.max_seats ? `${attrs.max_seats}座` : '-'}</Descriptions.Item>
            <Descriptions.Item label="行程时长" span={2}>{attrs.duration || '-'}</Descriptions.Item>
        </>
    )

    return (
        <div style={{ marginTop: 16 }}>
            <Divider orientation="left" style={{ margin: '12px 0', fontSize: 14, color: '#666' }}>
                资源基本信息
            </Divider>
            <Descriptions bordered size="small" column={3}>
                <Descriptions.Item label="资源名称">{resource.resource_name}</Descriptions.Item>
                <Descriptions.Item label="资源类型">
                    <Tag color="blue">{resourceType}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                    <Tag color={resource.status === 'active' ? 'green' : 'default'}>
                        {resource.status === 'active' ? '启用' : '停用'}
                    </Tag>
                </Descriptions.Item>
            </Descriptions>

            {/* 根据资源类型显示特定字段 */}
            {(resourceType === '门票' || resourceType === '酒店' || resourceType === '餐饮' || resourceType === '交通') && (
                <>
                    <Divider orientation="left" style={{ margin: '12px 0', fontSize: 14, color: '#666' }}>
                        {resourceType}详细信息
                    </Divider>
                    <Descriptions bordered size="small" column={3}>
                        {resourceType === '门票' && renderTicketAttrs()}
                        {resourceType === '酒店' && renderHotelAttrs()}
                        {resourceType === '餐饮' && renderDiningAttrs()}
                        {resourceType === '交通' && renderTransportAttrs()}
                        {attrs.additional_notes && (
                            <Descriptions.Item label="补充说明" span={3}>{attrs.additional_notes}</Descriptions.Item>
                        )}
                        {attrs.description && (
                            <Descriptions.Item label="详细介绍" span={3}>{attrs.description}</Descriptions.Item>
                        )}
                    </Descriptions>
                </>
            )}
        </div>
    )
}
