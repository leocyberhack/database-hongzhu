import { useEffect, useState } from 'react'
import { Card, Table, Tag, Space, Button, Select, Input, DatePicker, message, Popconfirm, Modal } from 'antd'
import { ReloadOutlined, SearchOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

const { RangePicker } = DatePicker

interface OperationLog {
    id: number
    table_name: string
    record_id: number
    operation: string
    diff_data: any
    operator: string
    operated_at: string
    source: string
}

const TABLE_NAME_MAP: Record<string, string> = {
    'poi': '资源',
    'resource': '子资源',
    'supplier': '供应商',
    'supplier_resource': '供应商子资源绑定',
    'resource_inventory': '子资源库存',
    'product': '产品',
    'product_category': '产品分类',
    'sku': 'SKU(规格)',
    'channel': '渠道',
    'price': 'SKU价格',
    'inventory': 'SKU库存',
    'order': '订单',
    'approval': '审批',
    'file': '文件',
    'folder': '文件夹',
    'supplier_resource_agreements': '供应商协议',
    'supplier_resource_price_history': '供应商结算价历史',
    'price_history': 'SKU价格历史',
    'order_status_history': '订单状态历史',
    'inventory_log': '库存日志',
}

const OPERATION_MAP: Record<string, { label: string; color: string }> = {
    'CREATE': { label: '新增', color: 'green' },
    'UPDATE': { label: '修改', color: 'blue' },
    'DELETE': { label: '删除', color: 'red' },
    'BATCH_UPDATE': { label: '批量更新', color: 'purple' },
    'BATCH_INIT': { label: '批量初始化', color: 'cyan' },
    'STATUS_CHANGE': { label: '状态变更', color: 'orange' },
}

const ACTION_VALUE_MAP: Record<string, string> = {
    'verify': '核销',
    'refund': '退款',
    'refund_unverified': '未核销退款',
    'refund_unreserved': '未预约退款',
    'refund_verified': '已核销退款',
    'refund_reserved': '已预约退款',
    'freeze': '冻结库存',
    'consume': '扣减库存',
    'release': '释放库存',
    'return': '退回库存',
}

const TYPE_VALUE_MAP: Record<string, string> = {
    'settlement_price_change': '结算价调整',
    'manual_adjust': '手动调整',
}

const SUPPLIER_MODE_MAP: Record<string, string> = {
    'locked': '锁定供应商',
    'auto': '自动选择',
}

const FIELD_NAME_MAP: Record<string, string> = {
    'order_no': '订单号',
    'order_id': '订单ID',
    'sku_id': 'SKU编号',
    'spu_id': 'SPU编号',
    'spu_name': 'SPU名称',
    'product_name': '产品名称',
    'travel_date': '出行日期',
    'quantity': '数量',
    'sale_amount': '销售金额',
    'cost_amount': '成本金额',
    'profit_amount': '利润',
    'remark': '备注',
    'created_by': '创建人',
    'created_at': '创建时间',
    'before_status': '变更前状态',
    'after_status': '变更后状态',
    'reason': '原因',
    'action': '操作',
    'qty': '数量',
    'amount': '金额',
    'at': '时间',

    'is_paid': '是否支付',
    'paid_qty': '支付数量',
    'paid_amount': '支付金额',
    'paid_at': '支付时间',
    'is_issued': '是否出票/发码/发短信',
    'issued_qty': '出票/发码数量',
    'issued_amount': '出票/发码金额',
    'issued_at': '出票/发码时间',
    'is_verified': '是否核销',
    'verified_qty': '核销数量',
    'verified_amount': '核销金额',
    'verified_at': '核销时间',
    'is_reserved': '是否预约',
    'reserved_qty': '预约数量',
    'reserved_amount': '预约金额',
    'reserved_at': '预约时间',
    'is_refund_unverified': '是否支付后未核销退款',
    'refund_unverified_qty': '未核销退款数量',
    'refund_unverified_amount': '未核销退款金额',
    'refund_unverified_at': '未核销退款时间',
    'is_refund_unreserved': '是否支付后未预约退款',
    'refund_unreserved_qty': '未预约退款数量',
    'refund_unreserved_amount': '未预约退款金额',
    'refund_unreserved_at': '未预约退款时间',
    'is_refund_verified': '是否支付后已核销退款',
    'refund_verified_qty': '已核销退款数量',
    'refund_verified_amount': '已核销退款金额',
    'refund_verified_at': '已核销退款时间',
    'is_refund_reserved': '是否支付后已预约退款',
    'refund_reserved_qty': '已预约退款数量',
    'refund_reserved_amount': '已预约退款金额',
    'refund_reserved_at': '已预约退款时间',
    'is_completed': '是否完成',
    'completed_qty': '完成数量',
    'completed_amount': '完成金额',
    'completed_at': '完成时间',
    'is_disputed': '是否产生纠纷',
    'disputed_qty': '纠纷数量',
    'disputed_amount': '纠纷金额',
    'disputed_at': '纠纷时间',

    'poi_name': '资源名称',
    'province': '省份',
    'city': '城市',
    'district': '区/县',
    'address': '地址',
    'status': '状态',
    'resource_name': '子资源名称',
    'resource_type': '子资源类型',
    'poi_id': '所属资源',
    'supplier_id': '供应商',
    'settlement_price': '结算价',
    'supplier_name': '供应商名称',
    'contact_info': '联系方式',
    'attrs': '扩展字段',
    'supplier_code': '供应商编码',
    'business_scope': '业务范围',
    'contact_email': '联系邮箱',
    'license_no': '营业执照号',
    'legal_person': '法人信息',
    'credit_code': '信用代码',
    'category_id': '分类',
    'description': '描述',
    'suggested_price': '建议零售价',
    'structure_hash': '子资源组合哈希',
    'name': '名称',
    'sku_name': 'SKU名称',
    'product_id': '关联产品',
    'channel_id': '渠道',
    'channel_name': '渠道名称',
    'channel_type': '渠道类型',
    'commission_rate': '佣金比例',
    'sale_price': '销售价',
    'cost_price': '成本价',
    'date_range': '日期范围',
    'start_at': '开始日期',
    'end_at': '结束日期',
    'price': '价格',
    'total_qty': '总库存',
    'before': '修改前',
    'after': '修改后',
    'message': '消息',
    
    'result': '结果',
    'comment': '备注',
    'type': '类型',
    'before_price': '修改前价格',
    'after_price': '修改后价格',
    'records_affected': '影响记录数',
    'set_total_qty': '设置总库存',
    'set_price': '设置价格',
    'stats': '统计信息',
    'records_updated': '更新记录数',
    'records_created': '创建记录数',
    'before_sum_qty': '修改前总库存',
    'after_sum_qty': '修改后总库存',
    'change_qty': '库存变化',
    'resources': '子资源详情',
    'resource_id': '子资源ID',
    'before_prices': '原有价格详情(被覆盖)',
    'allowed_channels': '渠道配置',
    'stock_ratio': '库存配额(%)',
    'supplier_mode': '供应商选择方式',
    'supplier_ids': '供应商列表',
    'required_flag': '是否必选',
    'hotel_type': '酒店类型',
    'star_rating': '星级',
    'check_in_time': '入住时间',
    'check_out_time': '退房时间',
    'room_type': '房型',
    'bed_type': '床型',
    'breakfast_included': '含早',
    'restaurant_name': '餐厅名称',
    'restaurant_address': '餐厅地址',
    'phone': '电话',
    'opening_time': '营业开始时间',
    'closing_time': '营业结束时间',
    'meal_types': '餐饮类型',
    'dining_category': '餐饮分类',
    'includes_details': '包含内容',
    'suitable_for_people': '适配人数',
    'parking': '停车场信息',
    'reservation_required': '需要预约',
    'filename': '文件名',
    'folder_id': '文件夹',
    'object_name': '对象路径',
    'content_type': '类型',
    'size': '大小',
    'url': '链接',
    'parent_id': '父文件夹',
    'has_password': '密码状态',
    'poi_code': '资源编码',
    'resource_code': '子资源编码',
    'poi_type': '资源类型',
    'tags': '标签',
    'type_options': '类型选项',
    'longitude': '经度',
    'latitude': '纬度',
    'supply_status': '供给状态',
    'currency': '货币',
    'rule': '规则',
    'priority': '优先级',
    'supplier_resource_id': '供应商子资源ID',
    'inventory_date': '库存日期',
    'frozen_qty': '冻结库存',
    'sold_qty': '已售库存',
    'agreement_name': '协议名称',
    'start_date': '开始日期',
    'end_date': '结束日期',
    'signing_date': '签署日期',
    'payment_method': '付款方式',
    'requires_invoice': '是否需要发票',
    'invoice_type': '发票类型',
    'discount_methods': '优惠方式',
    'discount_policy': '优惠政策',
    'attached_files': '附件',
    'settlement_cycle': '结算周期',
}

const FIELD_ORDER = Object.keys(FIELD_NAME_MAP)
const FIELD_ORDER_INDEX = new Map(FIELD_ORDER.map((key, index) => [key, index]))

const sortFieldKeys = (keys: string[]) => {
    return [...keys].sort((a, b) => {
        const aIndex = FIELD_ORDER_INDEX.get(a)
        const bIndex = FIELD_ORDER_INDEX.get(b)
        if (aIndex !== undefined || bIndex !== undefined) {
            return (aIndex ?? Number.MAX_SAFE_INTEGER) - (bIndex ?? Number.MAX_SAFE_INTEGER)
        }
        return a.localeCompare(b)
    })
}

const STATUS_MAP: Record<string, string> = {
    'active': '启用',
    'inactive': '停用',
    'draft': '草稿',
    'normal': '正常',
    'pending': '待审批',
    'approved': '已通过',
    'rejected': '已拒绝',
    'expired': '已过期',
}

export default function OperationLogsPage() {
    const { user } = useAuth()
    const [logs, setLogs] = useState<OperationLog[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [filters, setFilters] = useState({
        table_name: null as string | null,
        operator: null as string | null,
        operation: null as string | null,
        dateRange: null as [Dayjs, Dayjs] | null,
    })
    const [detailLog, setDetailLog] = useState<OperationLog | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const isAdmin = user?.username === 'admin'

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
                include_diff: 'false',
            })
            if (filters.table_name) params.append('table_name', filters.table_name)
            if (filters.operator) params.append('operator', filters.operator)
            if (filters.operation) params.append('operation', filters.operation)
            if (filters.dateRange) {
                const [start, end] = filters.dateRange
                params.append('start_date', start.format('YYYY-MM-DD'))
                params.append('end_date', end.format('YYYY-MM-DD'))
            }

            const res = await apiRequest<{ items: OperationLog[]; pagination: { total: number } }>(
                `/api/audit-log?${params.toString()}`
            )

            setLogs(res.items || [])
            setPagination(prev => ({ ...prev, total: res.pagination?.total || 0 }))
        } catch (err: any) {
            console.error('获取日志失败:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
    }, [pagination.current, pagination.pageSize, filters])

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return

        try {
            await apiRequest('/api/audit-log/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`已删除 ${selectedRowKeys.length} 条日志`)
            setSelectedRowKeys([])
            await fetchLogs()
        } catch (err: any) {
            message.error(err.message || '批量删除失败')
        }
    }

    const openDetail = async (logId: number) => {
        setDetailLoading(true)
        try {
            const res = await apiRequest<OperationLog>(`/api/audit-log/${logId}`)
            setDetailLog(res)
        } catch (err: any) {
            message.error(err.message || '加载日志详情失败')
        } finally {
            setDetailLoading(false)
        }
    }

    const formatDiffData = (data: any): string => {
        if (!data) return '-'

        try {
            const parts: string[] = []
            const mapObjectKeys = (value: any): any => {
                if (Array.isArray(value)) {
                    return value.map((item) => mapObjectKeys(item))
                }
                if (value && typeof value === 'object') {
                    const mapped: Record<string, any> = {}
                    Object.keys(value).forEach((k) => {
                        const mappedKey = FIELD_NAME_MAP[k] || k
                        mapped[mappedKey] = translateValue(k, value[k])
                    })
                    return mapped
                }
                return value
            }
            const translateValue = (key: string, value: any): any => {
                if (value === null || value === undefined) {
                    return '-'
                }
                if (typeof value === 'boolean') {
                    return value ? '是' : '否'
                }
                if (typeof value === 'string') {
                    if (key === 'status' || key === 'before_status' || key === 'after_status' || key.endsWith('_status')) {
                        return ACTION_VALUE_MAP[value] || STATUS_MAP[value] || value
                    }
                    if (key === 'action') {
                        return ACTION_VALUE_MAP[value] || value
                    }
                    if (key === 'type') {
                        return TYPE_VALUE_MAP[value] || value
                    }
                    if (key === 'supplier_mode') {
                        return SUPPLIER_MODE_MAP[value] || value
                    }
                }
                if (Array.isArray(value)) {
                    return value.map((item) => translateValue(key, item))
                }
                if (typeof value === 'object' && value !== null) {
                    return mapObjectKeys(value)
                }
                return value
            }
            const formatValue = (key: string, value: any) => {
                const translated = translateValue(key, value)
                if (translated && typeof translated === 'object') {
                    return JSON.stringify(translated, null, 2)
                }
                return translated
            }
            const pushFields = (label: string, payload: Record<string, any>) => {
                parts.push(label)
                sortFieldKeys(Object.keys(payload)).forEach((key) => {
                    const fieldName = FIELD_NAME_MAP[key] || key
                    parts.push(`${fieldName}: ${formatValue(key, payload[key])}`)
                })
            }

            if (data.date_range) {
                parts.push(`${FIELD_NAME_MAP['date_range'] || '日期范围'}: ${data.date_range}`)
            }

            if (data.type) {
                parts.push(`${FIELD_NAME_MAP['type'] || '类型'}: ${formatValue('type', data.type)}`)
            }

            if (data.stats) {
                parts.push('【统计信息】')
                sortFieldKeys(Object.keys(data.stats)).forEach((key) => {
                    const value = formatValue(key, data.stats[key])
                    const fieldName = FIELD_NAME_MAP[key] || key
                    parts.push(`${fieldName}: ${value}`)
                })
            }

            const hasBefore = data.before !== undefined && data.before !== null
            const hasAfter = data.after !== undefined && data.after !== null
            if (hasBefore || hasAfter) {
                if (hasBefore && hasAfter) {
                    pushFields('【修改前】', data.before)
                    pushFields('【修改后】', data.after)
                } else if (hasAfter) {
                    pushFields('【创建内容】', data.after)
                } else {
                    pushFields('【删除前】', data.before)
                }
            } else {
                const keys = Object.keys(data).filter((key) => !['before', 'after', 'date_range', 'type', 'stats'].includes(key))
                sortFieldKeys(keys).forEach((key) => {
                    const fieldName = FIELD_NAME_MAP[key] || key
                    parts.push(`${fieldName}: ${formatValue(key, data[key])}`)
                })
            }

            return parts.join('\n')
        } catch {
            return JSON.stringify(data, null, 2)
        }
    }

    const columns = [
        {
            title: '时间',
            dataIndex: 'operated_at',
            width: 170,
            render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
            sorter: (a: OperationLog, b: OperationLog) =>
                new Date(a.operated_at).getTime() - new Date(b.operated_at).getTime(),
        },
        {
            title: '操作人',
            dataIndex: 'operator',
            width: 100,
            render: (v: string) => v || '-',
        },
        {
            title: '对象类型',
            dataIndex: 'table_name',
            width: 120,
            render: (v: string) => (
                <Tag color="blue">{TABLE_NAME_MAP[v] || v}</Tag>
            ),
        },
        {
            title: '记录ID',
            dataIndex: 'record_id',
            width: 80,
        },
        {
            title: '操作',
            dataIndex: 'operation',
            width: 100,
            render: (v: string) => {
                const op = OPERATION_MAP[v] || { label: v, color: 'default' }
                return <Tag color={op.color}>{op.label}</Tag>
            },
        },
        {
            title: '详情',
            render: (_: any, record: OperationLog) => (
                <Button
                    type="link"
                    size="small"
                    onClick={() => openDetail(record.id)}
                >
                    查看
                </Button>
            ),
        },
    ]

    return (
        <div style={{ padding: 24, width: '100%', minWidth: '100%' }}>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        操作日志
                    </h1>
                    <p className="page-subtitle">查看系统所有操作的审计记录</p>
                </div>
                <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={fetchLogs}
                    loading={loading}
                >
                    刷新
                </Button>
            </div>

            <Card size="small" style={{ marginBottom: 16 }}>
                <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space wrap>
                        <Select
                            placeholder="筛选对象类型"
                            allowClear
                            style={{ width: 200 }}
                            value={filters.table_name}
                            onChange={(v) => setFilters({ ...filters, table_name: v })}
                            options={Object.entries(TABLE_NAME_MAP).map(([key, label]) => ({
                                value: key,
                                label: label,
                            }))}
                        />
                        <Select
                            placeholder="筛选操作类型"
                            allowClear
                            style={{ width: 150 }}
                            value={filters.operation}
                            onChange={(v) => setFilters({ ...filters, operation: v })}
                            options={Object.entries(OPERATION_MAP).map(([key, { label }]) => ({
                                value: key,
                                label: label,
                            }))}
                        />
                        <Input
                            placeholder="筛选操作人"
                            allowClear
                            style={{ width: 200 }}
                            prefix={<SearchOutlined />}
                            value={filters.operator || ''}
                            onChange={(e) => setFilters({ ...filters, operator: e.target.value || null })}
                        />
                        <RangePicker
                            placeholder={['起始时间', '结束时间']}
                            showTime
                            format="YYYY-MM-DD HH:mm:ss"
                            style={{ width: 400 }}
                            value={filters.dateRange}
                            onChange={(dates) => setFilters({ ...filters, dateRange: dates as [Dayjs, Dayjs] | null })}
                        />
                    </Space>
                    {isAdmin && selectedRowKeys.length > 0 && (
                        <Popconfirm
                            title={`确定删除选中的 ${selectedRowKeys.length} 条日志吗？`}
                            description="此操作不可恢复"
                            onConfirm={handleBatchDelete}
                            okText="确定删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                        >
                            <Button danger icon={<DeleteOutlined />}>
                                批量删除 ({selectedRowKeys.length})
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            </Card>

            <div className="glass-card" style={{ padding: 24 }}>
                <Table<OperationLog>
                    rowKey="id"
                    columns={columns}
                    dataSource={logs}
                    loading={loading}
                    rowSelection={isAdmin ? {
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    } : undefined}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 })),
                    }}
                />
            </div>

            <Modal
                title="操作详情"
                open={!!detailLog}
                onCancel={() => setDetailLog(null)}
                footer={null}
                width={720}
            >
                {detailLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
                ) : (
                    <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        lineHeight: 1.6,
                    }}>
                        {formatDiffData(detailLog?.diff_data)}
                    </pre>
                )}
            </Modal>
        </div>
    )
}
