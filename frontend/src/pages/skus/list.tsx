import { useState, useRef, useMemo } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, message, Card, Row, Col } from 'antd'
import { PlusOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { SKU } from '@/types'
import SKUCalendarEditor from '@/components/SKUCalendarEditor';
import type { SKUCalendarEditorRef } from '@/components/SKUCalendarEditor';

// SKU状态中文映射
const STATUS_MAP: Record<string, { label: string; color: string }> = {
    'draft': { label: '草稿', color: 'default' },
    'active': { label: '上架', color: 'green' },
    'offline': { label: '下架', color: 'orange' },
    'archived': { label: '已归档', color: 'gray' },
}

export default function SKUListPage() {
    const { data, refresh } = useData()
    const skus = data?.skus ?? []
    const products = data?.products ?? []
    const channels = data?.channels ?? []
    const poiList = data?.poi ?? []
    const [modalVisible, setModalVisible] = useState(false)
    const [editingSku, setEditingSku] = useState<SKU | null>(null)
    const [form] = Form.useForm()
    const calendarEditorRef = useRef<SKUCalendarEditorRef>(null)

    // 筛选器状态
    const [filters, setFilters] = useState<{
        keyword: string;
        product_id: string | undefined;
        poi_id: string | undefined;
        status: string | undefined;
    }>({
        keyword: '',
        product_id: undefined,
        poi_id: undefined,
        status: undefined,
    })

    // 筛选后的数据
    const filteredSkus = useMemo(() => {
        return skus.filter((sku: SKU) => {
            // 关键词筛选
            if (filters.keyword) {
                const keyword = filters.keyword.toLowerCase()
                const matchName = sku.sku_name?.toLowerCase().includes(keyword)
                if (!matchName) return false
            }
            // 产品筛选
            if (filters.product_id && sku.product_id !== filters.product_id) {
                return false
            }
            // POI筛选
            if (filters.poi_id && String(sku.poi_id) !== String(filters.poi_id)) {
                return false
            }
            // 状态筛选
            if (filters.status && sku.status !== filters.status) {
                return false
            }
            return true
        })
    }, [skus, filters])

    const handleSaveSKU = async (values: any) => {
        try {
            // Map form values to API payload
            const payload = {
                sku_name: values.name,
                product_id: values.product_id,
                status: values.status,
            }

            let savedSkuId: number;
            const selectedChannelId = values.channel_id;

            if (editingSku) {
                // Update existing
                await apiRequest(`/api/skus/${editingSku.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                })
                savedSkuId = Number(editingSku.id);
            } else {
                // Create new
                const res = await apiRequest('/api/skus', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                }) as { id: number }
                savedSkuId = res.id;
            }

            // Save inventory/prices if any
            if (calendarEditorRef.current) {
                await calendarEditorRef.current.saveToBackend(savedSkuId, selectedChannelId)
            }

            message.success(editingSku ? 'SKU更新成功' : 'SKU创建成功')
            setModalVisible(false)
            setEditingSku(null)
            form.resetFields()
            await refresh()
        } catch (err: any) {
            message.error(err.message || (editingSku ? '更新失败' : '创建失败'))
        }
    }

    const startEdit = (record: SKU) => {
        setEditingSku(record)
        form.setFieldsValue({
            name: record.sku_name,
            product_id: record.product_id,
            status: record.status,
            channel_id: 1, // TODO: 从SKU-Channel绑定中获取
        })
        setModalVisible(true)
    }

    const handleDelete = async (id: number) => {
        Modal.confirm({
            title: '确认删除',
            content: '确定要删除这个 SKU 吗？此操作不可逆。',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await apiRequest(`/api/skus/${id}`, { method: 'DELETE' })
                    message.success('删除成功')
                    await refresh()
                } catch (err: any) {
                    message.error(err.message || '删除失败')
                }
            },
        })
    }

    const columns = [
        { title: 'SKU 名称', dataIndex: 'sku_name' },
        {
            title: '关联产品',
            dataIndex: 'product_id',
            render: (v: string) => products.find((p) => p.id === v)?.product_name || '-',
        },
        {
            title: '所属区域',
            dataIndex: 'poi_id',
            render: (v: string) => poiList.find((p) => String(p.id) === String(v))?.poi_name || '-',
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => {
                const status = STATUS_MAP[v] || { label: v, color: 'default' }
                return <Tag color={status.color}>{status.label}</Tag>
            }
        },
        {
            title: '操作',
            render: (_: any, record: SKU) => (
                <Space>
                    <Button type="link" size="small" onClick={() => startEdit(record)}>查看</Button>
                    <Button type="link" size="small" onClick={() => startEdit(record)}>编辑</Button>
                    <Button type="link" size="small" danger onClick={() => handleDelete(Number(record.id))}>删除</Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">SKU 管理 (M4)</h1>
                    <p className="page-subtitle">SKU 与渠道管理</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                    setEditingSku(null)
                    form.resetFields()
                    setModalVisible(true)
                }}>
                    新建 SKU
                </Button>
            </div>

            {/* 筛选器 */}
            <Card style={{ marginBottom: 16 }} size="small">
                <Row gutter={16} align="middle">
                    <Col span={6}>
                        <Input
                            placeholder="搜索SKU名称"
                            prefix={<SearchOutlined />}
                            value={filters.keyword}
                            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                            allowClear
                        />
                    </Col>
                    <Col span={5}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="筛选产品"
                            value={filters.product_id}
                            onChange={(v) => setFilters({ ...filters, product_id: v })}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={products.map((p) => ({ value: p.id, label: p.product_name }))}
                        />
                    </Col>
                    <Col span={5}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="筛选区域"
                            value={filters.poi_id}
                            onChange={(v) => setFilters({ ...filters, poi_id: v })}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={poiList.map((p) => ({ value: p.id, label: p.poi_name }))}
                        />
                    </Col>
                    <Col span={4}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="筛选状态"
                            value={filters.status}
                            onChange={(v) => setFilters({ ...filters, status: v })}
                            allowClear
                            options={[
                                { value: 'draft', label: '草稿' },
                                { value: 'active', label: '上架' },
                                { value: 'offline', label: '下架' },
                            ]}
                        />
                    </Col>
                    <Col>
                        <Button
                            icon={<ClearOutlined />}
                            onClick={() => setFilters({ keyword: '', product_id: undefined, poi_id: undefined, status: undefined })}
                        >
                            重置
                        </Button>
                    </Col>
                    <Col>
                        <span style={{ color: '#666' }}>
                            共 {filteredSkus.length} 条记录
                        </span>
                    </Col>
                </Row>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<SKU> rowKey="id" columns={columns} dataSource={filteredSkus} pagination={{ pageSize: 10 }} />
            </div>

            <Modal
                title={editingSku ? "编辑 SKU" : "创建 SKU"}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false)
                    setEditingSku(null)
                    form.resetFields()
                }}
                footer={null}
                width={1100}
            >
                <Form form={form} layout="vertical" onFinish={handleSaveSKU}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="product_id" label="关联产品" rules={[{ required: true, message: '请选择产品' }]}>
                                <Select
                                    placeholder="选择产品"
                                    showSearch
                                    optionFilterProp="label"
                                    options={products.map((p) => ({ value: p.id, label: p.product_name }))}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="channel_id" label="销售渠道" rules={[{ required: true, message: '请选择渠道' }]}>
                                <Select
                                    placeholder="选择渠道"
                                    showSearch
                                    optionFilterProp="label"
                                    options={channels.map((c: any) => ({ value: c.id, label: c.channel_name }))}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="name" label="SKU名称" rules={[{ required: true, message: '请输入SKU名称' }]}>
                                <Input placeholder="例如：北京三日游-标准版" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="status" label="状态" initialValue="draft">
                                <Select
                                    options={[
                                        { value: 'draft', label: '草稿' },
                                        { value: 'active', label: '上架' },
                                        { value: 'offline', label: '下架' },
                                    ]}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Calendar Editor Embedded */}
                    <div style={{ marginBottom: 24 }}>
                        <SKUCalendarEditor ref={calendarEditorRef} skuId={editingSku?.id ? Number(editingSku.id) : undefined} />
                    </div>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setModalVisible(false)
                                setEditingSku(null)
                                form.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                {editingSku ? "保存" : "创建"}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
