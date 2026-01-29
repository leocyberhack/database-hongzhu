import { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, InputNumber, Select, DatePicker, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Order } from '@/types'

interface OptionItem {
    value: string
    label: string
}

export default function OrdersPage() {
    const { data, loadData } = useData()
    const channels = data.channels ?? []

    const [rows, setRows] = useState<Order[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [form] = Form.useForm()

    const [skuOptions, setSkuOptions] = useState<OptionItem[]>([])
    const [productOptions, setProductOptions] = useState<OptionItem[]>([])
    const [skuLoading, setSkuLoading] = useState(false)
    const [productLoading, setProductLoading] = useState(false)

    useEffect(() => {
        loadData(['channels'])
    }, [loadData])

    const fetchOrders = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
            })
            const res = await apiRequest<{ items: Order[]; pagination: { total: number } }>(`/api/orders?${params.toString()}`)
            setRows(res.items || [])
            setPagination(prev => ({ ...prev, total: res.pagination?.total || 0 }))
        } catch (err: any) {
            message.error(err.message || '加载订单失败')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [pagination.current, pagination.pageSize])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    const fetchSkuOptions = useCallback(async (keyword?: string) => {
        setSkuLoading(true)
        try {
            const params = new URLSearchParams({ page: '1', page_size: '20' })
            if (keyword && keyword.trim()) params.append('keyword', keyword.trim())
            const res = await apiRequest<{ items: { id: string; sku_name: string }[] }>(`/api/skus?${params.toString()}`)
            setSkuOptions((res.items || []).map(item => ({ value: String(item.id), label: item.sku_name })))
        } finally {
            setSkuLoading(false)
        }
    }, [])

    const fetchProductOptions = useCallback(async (keyword?: string) => {
        setProductLoading(true)
        try {
            const params = new URLSearchParams({ page: '1', page_size: '20' })
            if (keyword && keyword.trim()) params.append('keyword', keyword.trim())
            const res = await apiRequest<{ items: { id: string; product_name: string }[] }>(`/api/products?${params.toString()}`)
            setProductOptions((res.items || []).map(item => ({ value: String(item.id), label: item.product_name })))
        } finally {
            setProductLoading(false)
        }
    }, [])

    const handleCreateOrder = async (values: any) => {
        try {
            const payload = {
                ...values,
                travel_date: values.travel_date.format('YYYY-MM-DD'),
            }
            await apiRequest('/api/orders', {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            message.success('订单创建成功')
            setCreateModalVisible(false)
            form.resetFields()
            await fetchOrders()
        } catch (err: any) {
            message.error(err.message || '创建失败')
        }
    }

    const columns = [
        { title: '订单号', dataIndex: 'order_no', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
        {
            title: '渠道',
            dataIndex: 'channel_name',
            render: (_: string, record: Order) => record.channel_name || '-'
        },
        {
            title: 'SKU',
            dataIndex: 'sku_name',
            render: (_: string, record: Order) => record.sku_name || '-'
        },
        { title: '数量', dataIndex: 'quantity' },
        { title: '售价', dataIndex: 'sale_price', render: (v: number) => `¥${v}` },
        { title: '销售额', dataIndex: 'sale_amount', render: (v: number) => `¥${v}` },
        { title: '出行日期', dataIndex: 'travel_date' },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => (
                <Tag color={v === 'verified' ? 'green' : v === 'paid' ? 'blue' : v === 'refunded' ? 'red' : 'gray'}>{v}</Tag>
            ),
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
                }}
                footer={null}
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleCreateOrder}>
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
                    <Form.Item name="sku_id" label="SKU" rules={[{ required: true, message: '请选择SKU' }]}>
                        <Select
                            placeholder="搜索 SKU"
                            showSearch
                            filterOption={false}
                            onSearch={fetchSkuOptions}
                            onFocus={() => fetchSkuOptions()}
                            options={skuOptions}
                            loading={skuLoading}
                        />
                    </Form.Item>
                    <Form.Item name="product_id" label="产品" rules={[{ required: true, message: '请选择产品' }]}>
                        <Select
                            placeholder="搜索产品"
                            showSearch
                            filterOption={false}
                            onSearch={fetchProductOptions}
                            onFocus={() => fetchProductOptions()}
                            options={productOptions}
                            loading={productLoading}
                        />
                    </Form.Item>
                    <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]} initialValue={1}>
                        <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="sale_price" label="售价" rules={[{ required: true, message: '请输入售价' }]}>
                        <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
                    </Form.Item>
                    <Form.Item name="travel_date" label="出行日期" rules={[{ required: true, message: '请选择出行日期' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setCreateModalVisible(false)
                                form.resetFields()
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
