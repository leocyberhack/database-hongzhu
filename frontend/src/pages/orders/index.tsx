import { useState, useEffect, useCallback } from 'react'
import type { Dayjs } from 'dayjs'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message, Radio, Divider, Card, Row, Col } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Order } from '@/types'

interface OptionItem {
    value: string
    label: string
}

interface OrderFilters {
    keyword: string
    channel_id: string | null
    spu_id: string | null
    sku_id: string | null
    travel_date: Dayjs | null
    paid_date: Dayjs | null
}

interface StatusGroup {
    key: string
    label: string
    timeLabel: string
    tagLabel: string
    tagColor: string
}

const STATUS_GROUPS: StatusGroup[] = [
    { key: 'issued', label: '是否出票/发码/发短信', timeLabel: '出票/发码时间', tagLabel: '已出票/发码', tagColor: 'cyan' },
    { key: 'verified', label: '是否核销', timeLabel: '核销时间', tagLabel: '已核销', tagColor: 'green' },
    { key: 'reserved', label: '是否预约', timeLabel: '预约时间', tagLabel: '已预约', tagColor: 'gold' },
    { key: 'refund_unverified', label: '是否支付后未核销全部退款', timeLabel: '未核销退款时间', tagLabel: '未核销退款', tagColor: 'red' },
    { key: 'refund_unreserved', label: '是否支付后未预约全部退款', timeLabel: '未预约退款时间', tagLabel: '未预约退款', tagColor: 'red' },
    { key: 'refund_verified', label: '是否支付后已核销全部/部分退款', timeLabel: '已核销退款时间', tagLabel: '已核销退款', tagColor: 'volcano' },
    { key: 'refund_reserved', label: '是否支付后已预约全部/部分退款', timeLabel: '已预约退款时间', tagLabel: '已预约退款', tagColor: 'volcano' },
    { key: 'completed', label: '是否完成', timeLabel: '完成时间', tagLabel: '已完成', tagColor: 'green' },
    { key: 'disputed', label: '是否完成后订单产生纠纷', timeLabel: '纠纷时间', tagLabel: '纠纷', tagColor: 'default' },
]

const INITIAL_FILTERS: OrderFilters = {
    keyword: '',
    channel_id: null,
    spu_id: null,
    sku_id: null,
    travel_date: null,
    paid_date: null,
}
export default function OrdersPage() {
    const { data, loadData } = useData()
    const channels = data.channels ?? []
    const spus = data.spus ?? []
    const { RangePicker } = DatePicker

    const [rows, setRows] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [form] = Form.useForm()
    const [filters, setFilters] = useState<OrderFilters>(INITIAL_FILTERS)

    const [skuOptions, setSkuOptions] = useState<OptionItem[]>([])
    const [skuLoading, setSkuLoading] = useState(false)
    const [selectedSpuId, setSelectedSpuId] = useState<string | undefined>(undefined)
    const [filterSkuOptions, setFilterSkuOptions] = useState<OptionItem[]>([])
    const [filterSkuLoading, setFilterSkuLoading] = useState(false)

    useEffect(() => {
        loadData(['channels', 'spus'])
    }, [loadData])

    const updateFilters = useCallback((next: Partial<OrderFilters>) => {
        setFilters((prev) => ({ ...prev, ...next }))
        setPagination((prev) => ({ ...prev, current: 1 }))
    }, [])

    const resetFilters = useCallback(() => {
        setFilters(INITIAL_FILTERS)
        setPagination((prev) => ({ ...prev, current: 1 }))
        setFilterSkuOptions([])
    }, [])

    const fetchOrders = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
            })
            if (filters.keyword.trim()) params.append('keyword', filters.keyword.trim())
            if (filters.channel_id) params.append('channel_id', String(filters.channel_id))
            if (filters.spu_id) params.append('spu_id', String(filters.spu_id))
            if (filters.sku_id) params.append('sku_id', String(filters.sku_id))
            if (filters.travel_date) {
                params.append('travel_date', filters.travel_date.format('YYYY-MM-DD'))
            }
            if (filters.paid_date) {
                params.append('paid_date', filters.paid_date.format('YYYY-MM-DD'))
            }
            const res = await apiRequest<{ items: Order[]; pagination: { total: number } }>(`/api/orders?${params.toString()}`)
            setRows(res.items || [])
            setPagination(prev => ({ ...prev, total: res.pagination?.total || 0 }))
        } catch (err: any) {
            message.error(err.message || '加载订单失败')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [filters, pagination.current, pagination.pageSize])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    const fetchSkuOptions = useCallback(async (keyword?: string, spuIdOverride?: string) => {
        const spuId = spuIdOverride ?? selectedSpuId
        if (!spuId) {
            setSkuOptions([])
            return
        }
        setSkuLoading(true)
        try {
            const params = new URLSearchParams({ page: '1', page_size: '50', spu_id: spuId })
            if (keyword && keyword.trim()) params.append('keyword', keyword.trim())
            const res = await apiRequest<{ items: { id: string; sku_name: string }[] }>(`/api/skus?${params.toString()}`)
            setSkuOptions((res.items || []).map(item => ({ value: String(item.id), label: item.sku_name })))
        } finally {
            setSkuLoading(false)
        }
    }, [selectedSpuId])

    const fetchFilterSkuOptions = useCallback(async (keyword?: string) => {
        setFilterSkuLoading(true)
        try {
            const params = new URLSearchParams({ page: '1', page_size: '50' })
            if (filters.spu_id) params.append('spu_id', String(filters.spu_id))
            if (keyword && keyword.trim()) params.append('keyword', keyword.trim())
            if (!filters.spu_id && !(keyword && keyword.trim())) {
                setFilterSkuOptions([])
                return
            }
            const res = await apiRequest<{ items: { id: string; sku_name: string }[] }>(`/api/skus?${params.toString()}`)
            setFilterSkuOptions((res.items || []).map(item => ({ value: String(item.id), label: item.sku_name })))
        } finally {
            setFilterSkuLoading(false)
        }
    }, [filters.spu_id])

    const statusInitialValues = STATUS_GROUPS.reduce<Record<string, boolean>>((acc, group) => {
        acc[`is_${group.key}`] = false
        return acc
    }, {})

    const handleCreateOrder = async (values: any) => {
        try {
            const { spu_id, ...rest } = values
            const saleAmountInput = Number(values.sale_price || 0)
            const qty = Number(values.quantity || 1)
            const unitPrice = qty > 0 ? saleAmountInput / qty : saleAmountInput
            const payload: any = {
                ...rest,
                travel_date: values.travel_date.format('YYYY-MM-DD'),
                sale_price: unitPrice,
                paid_at: values.paid_at.format('YYYY-MM-DD HH:mm'),
            }
            STATUS_GROUPS.forEach((group) => {
                const timeKey = `${group.key}_at`
                if (values[timeKey]) {
                    payload[timeKey] = values[timeKey].format('YYYY-MM-DD HH:mm')
                }
            })
            await apiRequest('/api/orders', {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            message.success('订单创建成功')
            setCreateModalVisible(false)
            form.resetFields()
            setSelectedSpuId(undefined)
            setSkuOptions([])
            await fetchOrders()
        } catch (err: any) {
            message.error(err.message || '创建失败')
        }
    }

    const columns = [
        {
            title: '订单号',
            dataIndex: 'order_no',
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="搜索订单号"
                        value={selectedKeys[0] ?? filters.keyword}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => {
                            confirm()
                            updateFilters({ keyword: selectedKeys[0] ? String(selectedKeys[0]) : '' })
                        }}
                        style={{ width: 200, marginBottom: 8, display: 'block' }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() => {
                                confirm()
                                updateFilters({ keyword: selectedKeys[0] ? String(selectedKeys[0]) : '' })
                            }}
                            icon={<SearchOutlined />}
                            size="small"
                            style={{ width: 90 }}
                        >
                            搜索
                        </Button>
                        <Button
                            onClick={() => {
                                clearFilters?.()
                                updateFilters({ keyword: '' })
                            }}
                            size="small"
                            style={{ width: 90 }}
                        >
                            重置
                        </Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
            filteredValue: filters.keyword ? [filters.keyword] : null,
            render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span>,
        },
        {
            title: '渠道',
            dataIndex: 'channel_id',
            filterDropdown: ({ confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Select
                        placeholder="选择渠道"
                        showSearch
                        optionFilterProp="label"
                        allowClear
                        value={filters.channel_id || undefined}
                        onChange={(value) => {
                            updateFilters({ channel_id: value ? String(value) : null })
                            confirm()
                        }}
                        options={channels.map((c) => ({ value: String(c.id), label: c.channel_name }))}
                        style={{ width: 220, marginBottom: 8 }}
                    />
                    <Space>
                        <Button type="primary" size="small" style={{ width: 90 }} onClick={() => confirm()}>
                            确定
                        </Button>
                        <Button
                            size="small"
                            style={{ width: 90 }}
                            onClick={() => {
                                clearFilters?.()
                                updateFilters({ channel_id: null })
                            }}
                        >
                            重置
                        </Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
            filteredValue: filters.channel_id ? [filters.channel_id] : null,
            render: (_: string, record: Order) => record.channel_name || '-'
        },
        {
            title: 'SPU',
            dataIndex: 'spu_id',
            sorter: (a: Order, b: Order) => (a.spu_name || '').localeCompare(b.spu_name || ''),
            defaultSortOrder: 'ascend' as const,
            filterDropdown: ({ confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Select
                        placeholder="选择 SPU"
                        showSearch
                        optionFilterProp="label"
                        allowClear
                        value={filters.spu_id || undefined}
                        onChange={(value) => {
                            updateFilters({ spu_id: value ? String(value) : null, sku_id: null })
                            setFilterSkuOptions([])
                            confirm()
                        }}
                        options={spus.map((s) => ({
                            value: String(s.id),
                            label: s.spu_code ? `${s.name} / ${s.spu_code}` : s.name,
                        }))}
                        style={{ width: 240, marginBottom: 8 }}
                    />
                    <Space>
                        <Button type="primary" size="small" style={{ width: 90 }} onClick={() => confirm()}>
                            确定
                        </Button>
                        <Button
                            size="small"
                            style={{ width: 90 }}
                            onClick={() => {
                                clearFilters?.()
                                updateFilters({ spu_id: null, sku_id: null })
                                setFilterSkuOptions([])
                            }}
                        >
                            重置
                        </Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
            filteredValue: filters.spu_id ? [filters.spu_id] : null,
            render: (_: string, record: Order) => record.spu_name || '-',
        },
        {
            title: 'SKU',
            dataIndex: 'sku_id',
            filterDropdown: ({ confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Select
                        placeholder={filters.spu_id ? '搜索 SKU' : '输入关键词搜索 SKU'}
                        showSearch
                        filterOption={false}
                        allowClear
                        value={filters.sku_id || undefined}
                        onSearch={(value) => fetchFilterSkuOptions(value)}
                        onFocus={() => {
                            if (filters.spu_id) {
                                fetchFilterSkuOptions()
                            }
                        }}
                        options={filterSkuOptions}
                        loading={filterSkuLoading}
                        onChange={(value) => {
                            updateFilters({ sku_id: value ? String(value) : null })
                            confirm()
                        }}
                        style={{ width: 240, marginBottom: 8 }}
                    />
                    <Space>
                        <Button type="primary" size="small" style={{ width: 90 }} onClick={() => confirm()}>
                            确定
                        </Button>
                        <Button
                            size="small"
                            style={{ width: 90 }}
                            onClick={() => {
                                clearFilters?.()
                                updateFilters({ sku_id: null })
                            }}
                        >
                            重置
                        </Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
            filteredValue: filters.sku_id ? [filters.sku_id] : null,
            render: (_: string, record: Order) => record.sku_name || '-'
        },
        { title: '数量', dataIndex: 'quantity' },
        { title: '销售金额', dataIndex: 'sale_amount', render: (v: number) => `¥${v}` },
        { title: '出行日期', dataIndex: 'travel_date' },
        { title: '支付日期', dataIndex: 'paid_at', render: (v?: string) => v || '-' },
        {
            title: '状态',
            key: 'status_flags',
            render: (_: string, record: Order) => {
                const tags = STATUS_GROUPS.filter(group => (record as any)[`is_${group.key}`])
                if (!tags.length) {
                    return <span>-</span>
                }
                return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {tags.map(group => (
                            <Tag key={group.key} color={group.tagColor}>
                                {group.tagLabel}
                            </Tag>
                        ))}
                    </div>
                )
            },
        },
        {
            title: '操作',
            render: () => (
                <Space>
                    <Button type="link" size="small">查看</Button>
                    <Button type="link" size="small">核销</Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">订单中心 (M7)</h1>
                    <p className="page-subtitle">订单管理与核销</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                    新建订单
                </Button>
            </div>

            <Card size="small" style={{ marginBottom: 16 }} bodyStyle={{ padding: '16px' }}>
                <Form layout="inline" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]} style={{ width: '100%' }}>
                        <Col span={6}>
                            <Form.Item label="关键字" style={{ marginBottom: 0, width: '100%' }}>
                                <Input
                                    placeholder="订单号"
                                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                    value={filters.keyword}
                                    onChange={(e) => updateFilters({ keyword: e.target.value })}
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="渠道" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部渠道"
                                    showSearch
                                    allowClear
                                    optionFilterProp="label"
                                    options={channels.map((c) => ({ value: String(c.id), label: c.channel_name }))}
                                    value={filters.channel_id || undefined}
                                    onChange={(v) => updateFilters({ channel_id: v ? String(v) : null })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="SPU" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部 SPU"
                                    showSearch
                                    allowClear
                                    optionFilterProp="label"
                                    options={spus.map((s) => ({
                                        value: String(s.id),
                                        label: s.spu_code ? `${s.name} / ${s.spu_code}` : s.name,
                                    }))}
                                    value={filters.spu_id || undefined}
                                    onChange={(v) => {
                                        updateFilters({ spu_id: v ? String(v) : null, sku_id: null })
                                        setFilterSkuOptions([])
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="SKU" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder={filters.spu_id ? '搜索 SKU' : '输入关键词搜索 SKU'}
                                    showSearch
                                    filterOption={false}
                                    allowClear
                                    value={filters.sku_id || undefined}
                                    onSearch={(value) => fetchFilterSkuOptions(value)}
                                    onFocus={() => {
                                        if (filters.spu_id) {
                                            fetchFilterSkuOptions()
                                        }
                                    }}
                                    options={filterSkuOptions}
                                    loading={filterSkuLoading}
                                    onChange={(v) => updateFilters({ sku_id: v ? String(v) : null })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="出行日期" style={{ marginBottom: 0, width: '100%' }}>
                                <DatePicker
                                    style={{ width: '100%' }}
                                    placeholder="选择日期"
                                    value={filters.travel_date}
                                    onChange={(date) => updateFilters({ travel_date: date || null })}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="支付日期" style={{ marginBottom: 0, width: '100%' }}>
                                <DatePicker
                                    style={{ width: '100%' }}
                                    placeholder="选择日期"
                                    value={filters.paid_date}
                                    onChange={(date) => updateFilters({ paid_date: date || null })}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Space>
                                <Button onClick={resetFilters}>重置筛选</Button>
                            </Space>
                        </Col>
                    </Row>
                </Form>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Order>
                    rowKey="id"
                    columns={columns}
                    dataSource={rows}
                    loading={loading}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || prev.pageSize })),
                    }}
                />
            </div>

            <Modal
                title="创建订单"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false)
                    form.resetFields()
                    setSelectedSpuId(undefined)
                    setSkuOptions([])
                }}
                footer={null}
                width={600}
                bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleCreateOrder}
                    initialValues={{ quantity: 1, ...statusInitialValues }}
                >
                    <Form.Item name="order_no" label="订单号" rules={[{ required: true, message: '请输入订单号' }]}>
                        <Input placeholder="例如：ORD20240101001" />
                    </Form.Item>
                    <Form.Item name="channel_id" label="渠道" rules={[{ required: true, message: '请选择渠道' }]}>
                        <Select
                            placeholder="选择渠道"
                            showSearch
                            optionFilterProp="label"
                            options={channels.map((c) => ({ value: c.id, label: c.channel_name }))}
                        />
                    </Form.Item>
                    <Form.Item name="spu_id" label="SPU" rules={[{ required: true, message: '请选择SPU' }]}>
                        <Select
                            placeholder="选择 SPU"
                            showSearch
                            optionFilterProp="label"
                            allowClear
                            options={spus.map((s) => ({
                                value: String(s.id),
                                label: s.spu_code ? `${s.name} / ${s.spu_code}` : s.name,
                            }))}
                            onChange={(value) => {
                                const next = value ? String(value) : undefined
                                setSelectedSpuId(next)
                                form.setFieldValue('sku_id', undefined)
                                setSkuOptions([])
                                if (next) {
                                    fetchSkuOptions(undefined, next)
                                }
                            }}
                        />
                    </Form.Item>
                    <Form.Item name="sku_id" label="SKU" rules={[{ required: true, message: '请选择SKU' }]}>
                        <Select
                            placeholder={selectedSpuId ? '搜索 SKU' : '请先选择 SPU'}
                            showSearch
                            filterOption={false}
                            disabled={!selectedSpuId}
                            onSearch={(value) => fetchSkuOptions(value)}
                            onFocus={() => {
                                if (!selectedSpuId) {
                                    message.warning('请先选择SPU')
                                    return
                                }
                                fetchSkuOptions()
                            }}
                            options={skuOptions}
                            loading={skuLoading}
                        />
                    </Form.Item>
                    <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="sale_price" label="销售金额" rules={[{ required: true, message: '请输入销售金额' }]}>
                        <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
                    </Form.Item>
                    <Form.Item name="paid_at" label="支付时间" rules={[{ required: true, message: '请选择支付时间' }]}>
                        <DatePicker style={{ width: '100%' }} showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" />
                    </Form.Item>
                    <Form.Item name="travel_date" label="出行日期" rules={[{ required: true, message: '请选择出行日期' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Divider style={{ margin: '8px 0 16px' }}>状态字段</Divider>
                    {STATUS_GROUPS.map((group) => (
                        <div
                            key={group.key}
                            style={{
                                marginBottom: 16,
                                padding: 12,
                                border: '1px solid #f0f0f0',
                                borderRadius: 8,
                                background: '#fafafa',
                            }}
                        >
                            <Form.Item
                                name={`is_${group.key}`}
                                label={group.label}
                                rules={[{ required: true, message: `请选择${group.label}` }]}
                            >
                                <Radio.Group
                                    options={[
                                        { label: '是', value: true },
                                        { label: '否', value: false },
                                    ]}
                                    onChange={(e) => {
                                        if (!e.target.value) {
                                            form.setFieldsValue({
                                                [`${group.key}_qty`]: undefined,
                                                [`${group.key}_amount`]: undefined,
                                                [`${group.key}_at`]: undefined,
                                            })
                                        }
                                    }}
                                />
                            </Form.Item>
                            <Form.Item shouldUpdate={(prev, cur) => prev[`is_${group.key}`] !== cur[`is_${group.key}`]} noStyle>
                                {({ getFieldValue }) =>
                                    getFieldValue(`is_${group.key}`) ? (
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                                gap: 12,
                                                marginLeft: 8,
                                            }}
                                        >
                                            <Form.Item name={`${group.key}_qty`} label="数量">
                                                <InputNumber min={0} style={{ width: '100%' }} />
                                            </Form.Item>
                                            <Form.Item name={`${group.key}_amount`} label="金额">
                                                <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
                                            </Form.Item>
                                            <Form.Item
                                                name={`${group.key}_at`}
                                                label={group.timeLabel}
                                                rules={[{ required: true, message: `请选择${group.timeLabel}` }]}
                                            >
                                                <DatePicker
                                                    style={{ width: '100%' }}
                                                    showTime={{ format: 'HH:mm' }}
                                                    format="YYYY-MM-DD HH:mm"
                                                />
                                            </Form.Item>
                                        </div>
                                    ) : null
                                }
                            </Form.Item>
                        </div>
                    ))}
                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setCreateModalVisible(false)
                                form.resetFields()
                                setSelectedSpuId(undefined)
                                setSkuOptions([])
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                创建
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
