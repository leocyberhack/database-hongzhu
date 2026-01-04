import { useState, useMemo } from 'react'
import { Button, Table, Tag, Space, Modal, Form, Input, Select, message, Card, Row, Col, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Product } from '@/types'
import { useNavigate } from 'react-router-dom'

interface FilterState {
    keyword: string
    category_id: string | null
    status: string | null
}

export default function ProductListPage() {
    const { data, refresh } = useData()
    const products = data?.products ?? []
    const categories = data?.product_categories ?? []
    const poiList = data?.poi ?? []
    const navigate = useNavigate()

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [batchUpdateForm] = Form.useForm()

    // 筛选器状态
    const [filters, setFilters] = useState<FilterState & { poi_id: string | null }>({
        keyword: '',
        category_id: null,
        poi_id: null,
        status: null,
    })

    // 过滤逻辑
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            // 关键词搜索
            if (filters.keyword && !p.product_name.toLowerCase().includes(filters.keyword.toLowerCase())) {
                return false
            }
            // 分类筛选
            if (filters.category_id && String(p.category_id) !== String(filters.category_id)) {
                return false
            }
            // POI筛选
            if (filters.poi_id && String(p.poi_id) !== String(filters.poi_id)) {
                return false
            }
            // 状态筛选
            if (filters.status && p.status !== filters.status) {
                return false
            }
            return true
        })
    }, [products, filters])

    const handleDelete = async (id: string) => {
        try {
            await apiRequest(`/api/products/${id}`, { method: 'DELETE' })
            message.success('产品已删除')
            await refresh()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            await apiRequest('/api/products/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`已删除 ${selectedRowKeys.length} 个产品`)
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量删除失败')
        }
    }

    const handleBatchUpdate = async (values: any) => {
        if (selectedRowKeys.length === 0) return
        try {
            const fields: any = {}
            if (values.status) fields.status = values.status
            if (values.category_id) fields.category_id = values.category_id

            if (Object.keys(fields).length === 0) {
                message.warning('请至少输入一个要修改的字段')
                return
            }

            await apiRequest('/api/products/batch-update', {
                method: 'POST',
                body: JSON.stringify({
                    ids: selectedRowKeys,
                    fields
                })
            })
            message.success(`已更新 ${selectedRowKeys.length} 个产品`)
            setBatchUpdateVisible(false)
            batchUpdateForm.resetFields()
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
    }

    const columns: any = [
        {
            title: '产品名称',
            dataIndex: 'product_name',
            sorter: (a: Product, b: Product) => a.product_name.localeCompare(b.product_name),
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="搜索名称"
                        value={selectedKeys[0]}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{ width: 188, marginBottom: 8, display: 'block' }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() => confirm()}
                            icon={<SearchOutlined />}
                            size="small"
                            style={{ width: 90 }}
                        >
                            搜索
                        </Button>
                        <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
                            重置
                        </Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
            onFilter: (value: string, record: Product) =>
                record.product_name.toLowerCase().includes(value.toLowerCase()),
        },
        {
            title: '分类',
            dataIndex: 'category_id',
            render: (v: string) => categories.find(c => String(c.id) === String(v))?.name || '-',
            filters: categories.map(c => ({ text: c.name, value: c.id })),
            onFilter: (value: string, record: Product) => String(record.category_id) === String(value),
        },
        {
            title: '主POI',
            dataIndex: 'poi_id',
            render: (v: string) => poiList.find(c => String(c.id) === String(v))?.poi_name || '-',
        },
        {
            title: '建议零售价',
            dataIndex: 'suggested_price',
            render: (v: number) => v ? `¥${v}` : '-',
            sorter: (a: Product, b: Product) => (a.suggested_price || 0) - (b.suggested_price || 0),
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => {
                const map: any = { active: '已上架', archived: '已下架', draft: '草稿' }
                return <Tag color={v === 'active' ? 'green' : v === 'archived' ? 'red' : 'orange'}>{map[v] || v}</Tag>
            },
            filters: [
                { text: '已上架', value: 'active' },
                { text: '草稿', value: 'draft' },
                { text: '已下架', value: 'archived' },
            ],
            onFilter: (value: string, record: Product) => record.status === value,
        },
        {
            title: '最后更新时间',
            dataIndex: 'updated_at',
            render: (v: string) => v ? new Date(v).toLocaleString() : '-',
            sorter: (a: Product, b: Product) => new Date(a.updated_at || '').getTime() - new Date(b.updated_at || '').getTime(),
        },
        {
            title: '操作',
            width: 150,
            render: (_: any, record: Product) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => navigate(`/products/editor?id=${record.id}`)}
                    >
                        编辑
                    </Button>
                    <Popconfirm
                        title="确定删除此产品吗？"
                        description="删除产品不可恢复，且可能影响已有订单（如果有）"
                        onConfirm={() => handleDelete(record.id)}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">产品列表</h1>
                    <p className="page-subtitle">管理所有产品，包括门票、酒店、线路及其组合</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/editor')}>
                    新建产品
                </Button>
            </div>

            {/* 高级筛选器 */}
            <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '16px' } }}>
                <Form layout="inline" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]} style={{ width: '100%' }}>
                        <Col span={6}>
                            <Form.Item label="关键词" style={{ marginBottom: 0, width: '100%' }}>
                                <Input
                                    placeholder="搜索产品名称"
                                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                    value={filters.keyword}
                                    onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="产品分类" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部分类"
                                    allowClear
                                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                                    value={filters.category_id}
                                    onChange={v => setFilters({ ...filters, category_id: v })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="POI区域" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部区域"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    options={poiList.map(c => ({ value: c.id, label: c.poi_name }))}
                                    value={filters.poi_id}
                                    onChange={v => setFilters({ ...filters, poi_id: v })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="状态" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部状态"
                                    allowClear
                                    options={[
                                        { value: 'active', label: '已上架' },
                                        { value: 'draft', label: '草稿' },
                                        { value: 'archived', label: '已下架' },
                                    ]}
                                    value={filters.status}
                                    onChange={v => setFilters({ ...filters, status: v })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6} style={{ textAlign: 'right' }}>
                            {selectedRowKeys.length > 0 && (
                                <Space>
                                    <Button onClick={() => setBatchUpdateVisible(true)} icon={<SettingOutlined />}>
                                        批量修改
                                    </Button>
                                    <Popconfirm
                                        title={`确定删除选中的 ${selectedRowKeys.length} 个产品吗？`}
                                        onConfirm={handleBatchDelete}
                                        okText="确定删除"
                                        cancelText="取消"
                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button danger icon={<DeleteOutlined />}>
                                            批量删除
                                        </Button>
                                    </Popconfirm>
                                </Space>
                            )}
                        </Col>
                    </Row>
                </Form>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Product>
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredProducts}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                    pagination={{ pageSize: 20 }}
                />
            </div>

            {/* 批量更新 Modal */}
            <Modal
                title={`批量修改已选的 ${selectedRowKeys.length} 个产品`}
                open={batchUpdateVisible}
                onCancel={() => setBatchUpdateVisible(false)}
                footer={null}
            >
                <Form layout="vertical" form={batchUpdateForm} onFinish={handleBatchUpdate}>
                    <p style={{ color: '#999', marginBottom: 16 }}>
                        请填写需要修改的字段，留空则不修改
                    </p>
                    <Form.Item name="status" label="状态">
                        <Select options={[
                            { value: 'active', label: '已上架' },
                            { value: 'draft', label: '草稿' },
                            { value: 'archived', label: '已下架' },
                        ]} allowClear placeholder="批量修改状态" />
                    </Form.Item>
                    <Form.Item name="category_id" label="分类">
                        <Select options={categories.map(c => ({ value: c.id, label: c.name }))} allowClear placeholder="批量修改分类" />
                    </Form.Item>
                    <Space style={{ float: 'right', marginTop: 16 }}>
                        <Button onClick={() => setBatchUpdateVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">
                            确认修改
                        </Button>
                    </Space>
                </Form>
            </Modal>
        </div>
    )
}
