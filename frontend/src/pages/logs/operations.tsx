import { useEffect, useState } from 'react'
import { Card, Table, Tag, Space, Button, Select, Input, DatePicker, message, Popconfirm } from 'antd'
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

// 表名翻译
const TABLE_NAME_MAP: Record<string, string> = {
    'poi': 'POI',
    'resource': '资源',
    'supplier': '供应商',
    'supplier_resource': '供应商-资源绑定',
    'resource_inventory': '资源库存',
    'product': '产品',
    'product_category': '产品分类',
    'sku': 'SKU',
    'channel': '渠道',
    'price': 'SKU价格',
    'inventory': 'SKU库存',
    'order': '订单',
    'approval': '审批',
    'file': '文件',
    'folder': '文件夹',
}

// 操作类型翻译和颜色
const OPERATION_MAP: Record<string, { label: string; color: string }> = {
    'CREATE': { label: '新增', color: 'green' },
    'UPDATE': { label: '修改', color: 'blue' },
    'DELETE': { label: '删除', color: 'red' },
    'BATCH_UPDATE': { label: '批量更新', color: 'purple' },
    'BATCH_INIT': { label: '批量初始化', color: 'cyan' },
    'STATUS_CHANGE': { label: '状态变更', color: 'orange' },
}

// 字段名翻译
const FIELD_NAME_MAP: Record<string, string> = {
    'poi_name': 'POI名称',
    'province': '省份',
    'city': '城市',
    'district': '区/县',
    'address': '地址',
    'status': '状态',
    'resource_name': '资源名称',
    'resource_type': '资源类型',
    'poi_id': '所属POI',
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
    'settlement_cycle': '结算周期',
    'settlement_method': '结算方式',
    'invoice_info': '发票信息',
    'contract_no': '合同编号',
    'contract_start_date': '合同开始时间',
    'contract_end_date': '合同结束时间',
    'product_name': '产品名称',
    'category_id': '分类',
    'description': '描述',
    'suggested_price': '建议零售价',
    'structure_hash': '资源组合哈希',
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
    'total_qty': '总库存',
    'before': '修改前',
    'after': '修改后',
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
    'resources': '资源详情',
    'resource_id': '资源ID',
    'quantity': '数量',
    'before_prices': '原有价格详情(被覆盖)',
    'allowed_channels': '渠道配置',
    'stock_ratio': '库存配额(%)',
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
    'reservation_required': '需要预定',
    'filename': '文件名',
    'folder_id': '所属文件夹',
    'object_name': '对象路径',
    'content_type': '类型',
    'size': '大小',
    'url': '链接',
    'parent_id': '父文件夹',
    'has_password': '密码状态',
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

// 状态值翻译
const STATUS_MAP: Record<string, string> = {
    'active': '启用',
    'inactive': '停用',
    'pending': '待审核',
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

    const isAdmin = user?.username === 'admin'

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
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
            console.error('Failed to fetch logs:', err)
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

    // 格式化diff_data显示
    const formatDiffData = (data: any): string => {
        if (!data) return '-'

        try {
            const parts: string[] = []

            // 特殊处理不同类型的diff_data
            if (data.date_range) {
                parts.push(`${FIELD_NAME_MAP['date_range'] || '日期范围'}: ${data.date_range}`)
            }

            if (data.type) {
                parts.push(`${FIELD_NAME_MAP['type'] || '类型'}: ${data.type}`)
            }

            // Stats object special handling
            if (data.stats) {
                parts.push('【统计信息】')
                sortFieldKeys(Object.keys(data.stats)).forEach((key) => {
                    const value = data.stats[key]
                    const fieldName = FIELD_NAME_MAP[key] || key
                    parts.push(`${fieldName}: ${value}`)
                })
                // We don't delete data.stats here because we want to preserve original data, 
                // but we should avoid iterating it again. 
                // However, the logic below iterates entries of `data` *only if not update*, 
                // and explicitly excludes 'stats' if we add check.
            }

            if (data.before && data.after) {
                // UPDATE操作，显示before/after
                parts.push('【修改前】')
                sortFieldKeys(Object.keys(data.before)).forEach((key) => {
                    const value = data.before[key]
                    const fieldName = FIELD_NAME_MAP[key] || key
                    let displayValue: any = value

                    if (key === 'status' && typeof value === 'string') {
                        displayValue = STATUS_MAP[value] || value
                    } else if (typeof value === 'object' && value !== null) {
                        displayValue = JSON.stringify(value, null, 2)
                    }
                    parts.push(`${fieldName}: ${displayValue}`)
                })
                parts.push('【修改后】')
                sortFieldKeys(Object.keys(data.after)).forEach((key) => {
                    const value = data.after[key]
                    const fieldName = FIELD_NAME_MAP[key] || key
                    let displayValue: any = value

                    if (key === 'status' && typeof value === 'string') {
                        displayValue = STATUS_MAP[value] || value
                    } else if (typeof value === 'object' && value !== null) {
                        displayValue = JSON.stringify(value, null, 2)
                    }
                    parts.push(`${fieldName}: ${displayValue}`)
                })
            } else {
                // CREATE/DELETE操作，直接显示数据
                const keys = Object.keys(data).filter((key) => !['before', 'after', 'date_range', 'type', 'stats'].includes(key))
                sortFieldKeys(keys).forEach((key) => {
                    const value = data[key]
                    const fieldName = FIELD_NAME_MAP[key] || key
                    let displayValue: any = value

                    if (key === 'status' && typeof value === 'string') {
                        displayValue = STATUS_MAP[value] || value
                    } else if (typeof value === 'object' && value !== null) {
                        displayValue = JSON.stringify(value, null, 2)
                    }

                    parts.push(`${fieldName}: ${displayValue}`)
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
            title: '操作详情',
            dataIndex: 'diff_data',
            render: (v: any) => (
                <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                }}>
                    {formatDiffData(v)}
                </pre>
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
                            placeholder={['起始时间', '终止时间']}
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
        </div>
    )
}
