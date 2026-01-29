import { useState, useMemo, useEffect, useCallback } from 'react'
import { Button, Table, Tag, Space, Modal, Form, Input, Select, message, Card, Row, Col, Popconfirm, Tooltip } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, SettingOutlined, EyeOutlined, CalendarOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Product } from '@/types'
import { useNavigate } from 'react-router-dom'
import ProductStockPreviewCalendar from '@/components/ProductStockPreviewCalendar'

interface FilterState {
    keyword: string
    category_id: string | null
    status: string | null
    poi_id: string | null
}

interface PoiOption {
    value: string
    label: string
}

export default function ProductListPage() {
    const { data, loadData } = useData()
    const categories = data.product_categories ?? []
    const navigate = useNavigate()

    const [rows, setRows] = useState<Product[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
    const [batchUpdateForm] = Form.useForm()
    const [inventoryModalVisible, setInventoryModalVisible] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [productInventory, setProductInventory] = useState<{ date: string, available_qty: number }[]>([])
    const [loadingInventory, setLoadingInventory] = useState(false)
    const [inventoryDays, setInventoryDays] = useState(30)

    const [filters, setFilters] = useState<FilterState>({
        keyword: '',
        category_id: null,
        poi_id: null,
        status: null,
    })

    const [sorter, setSorter] = useState<{ field?: string; order?: string }>({})

    const [poiOptions, setPoiOptions] = useState<PoiOption[]>([])
    const [poiLoading, setPoiLoading] = useState(false)

    const [keywordDebounced, setKeywordDebounced] = useState(filters.keyword)

    useEffect(() => {
        loadData(['product_categories'])
    }, [loadData])

    useEffect(() => {
        const t = setTimeout(() => {
            setKeywordDebounced(filters.keyword)
        }, 300)
        return () => clearTimeout(t)
    }, [filters.keyword])

    const fetchPoiOptions = useCallback(async (keyword?: string) => {
        setPoiLoading(true)
        try {
            const params = new URLSearchParams({ page: '1', page_size: '20' })
            if (keyword && keyword.trim()) {
                params.append('keyword', keyword.trim())
            }
            const res = await apiRequest<{ items: { id: number; poi_name: string }[] }>(`/api/poi?${params.toString()}`)
            const next = (res.items || []).map((p) => ({ value: String(p.id), label: p.poi_name }))
            setPoiOptions(next)
        } catch {
            setPoiOptions([])
        } finally {
            setPoiLoading(false)
        }
    }, [])

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
            })
            if (keywordDebounced.trim()) params.append('keyword', keywordDebounced.trim())
            if (filters.category_id) params.append('category_id', String(filters.category_id))
            if (filters.poi_id) params.append('poi_id', String(filters.poi_id))
            if (filters.status) params.append('status', String(filters.status))
            if (sorter.field) params.append('sort_field', sorter.field)
            if (sorter.order) params.append('sort_order', sorter.order)

            const res = await apiRequest<{ items: Product[]; pagination: { total: number } }>(
                `/api/products?${params.toString()}`
            )
            setRows(res.items || [])
            setPagination((prev) => ({ ...prev, total: res.pagination?.total || 0 }))
        } catch (err: any) {
            message.error(err.message || '加载产品失败')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [filters.category_id, filters.poi_id, filters.status, keywordDebounced, pagination.current, pagination.pageSize, sorter.field, sorter.order])

    useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    const handleDelete = async (id: string) => {
        try {
            await apiRequest(`/api/products/${id}`, { method: 'DELETE' })
            message.success('产品已删除')
            await fetchProducts()
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
            await fetchProducts()
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
            await fetchProducts()
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
    }

    const buildInventoryRange = useCallback((days: number) => {
        const start = new Date()
        const end = new Date(start)
        end.setDate(end.getDate() + days)
        return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)] as [string, string]
    }, [])

    const columns: any = [
        {
            title: '产品名称',
            dataIndex: 'product_name',
            sorter: true,
        },
        {
            title: '分类',
            dataIndex: 'category_name',
            render: (_: string, record: Product) => record.category_name || '-',
        },
        {
            title: '所属POI',
            dataIndex: 'poi_name',
            render: (_: string, record: Product) => record.poi_name || '-',
        },
        {
            title: '建议零售价',
            dataIndex: 'suggested_price',
            render: (v: number) => v ? `¥${v}` : '-',
            sorter: true,
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => {
                const map: any = { active: '已上架', archived: '已下架', draft: '草稿' }
                return <Tag color={v === 'active' ? 'green' : v === 'archived' ? 'red' : 'orange'}>{map[v] || v}</Tag>
            },
        },
        {
            title: '最后更新时间',
            dataIndex: 'updated_at',
            render: (v: string) => v ? new Date(v).toLocaleString() : '-',
            sorter: true,
        },
        {
            title: '操作',
            width: 150,
            render: (_: any, record: Product) => {
                const hasOrders = (record.order_count || 0) > 0
                const hasSkus = (record.sku_count || 0) > 0
                const isLocked = hasOrders || hasSkus
                const lockReason = hasOrders ? '该产品已有订单，无法删除' : '该产品已关联SKU，无法删除'
                return (
                    <Space>
                        <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/products/editor?id=${record.id}&readonly=true`)}
                        >
                            查看
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<CalendarOutlined />}
                            onClick={async () => {
                                setSelectedProduct(record)
                                setInventoryModalVisible(true)
                                setInventoryDays(30)
                                setLoadingInventory(true)
                                const [startDate, endDate] = buildInventoryRange(30)
                                try {
                                    const params = new URLSearchParams()
                                    params.append('start_date', startDate)
                                    params.append('end_date', endDate)
                                    const res = await apiRequest<{ items: { date: string, available_qty: number }[] }>(
                                        `/api/products/${record.id}/inventory?${params.toString()}`
                                    )
                                    setProductInventory(res.items || [])
                                } catch {
                                    message.error('加载库存失败')
                                    setProductInventory([])
                                } finally {
                                    setLoadingInventory(false)
                                }
                            }}
                        >
                            库存
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => navigate(`/products/editor?id=${record.id}`)}
                        >
                            编辑
                        </Button>
                        {isLocked ? (
                            <Tooltip title={lockReason}>
                                <Button type="link" danger disabled size="small" icon={<DeleteOutlined />}>删除</Button>
                            </Tooltip>
                        ) : (
                            <Popconfirm
                                title="确定删除此产品吗？"
                                description="删除产品不可恢复，且可能影响已有订单（如有）"
                                onConfirm={() => handleDelete(record.id)}
                                okText="删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                            >
                                <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
                            </Popconfirm>
                        )}
                    </Space>
                )
            },
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">产品列表</h1>
                    <p className="page-subtitle">管理所有产品，包含景区、酒店、线路及其组合</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/editor')}>
                    新建产品
                </Button>
            </div>

            <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '16px' } }}>
                <Form layout="inline" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]} style={{ width: '100%' }}>
                        <Col span={6}>
                            <Form.Item label="关键词" style={{ marginBottom: 0, width: '100%' }}>
                                <Input
                                    placeholder="搜索产品名称"
                                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                    value={filters.keyword}
                                    onChange={e => {
                                        setFilters(prev => ({ ...prev, keyword: e.target.value }))
                                        setPagination(prev => ({ ...prev, current: 1 }))
                                    }}
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
                                    onChange={v => {
                                        setFilters(prev => ({ ...prev, category_id: v || null }))
                                        setPagination(prev => ({ ...prev, current: 1 }))
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="POI区域" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="输入POI搜索"
                                    allowClear
                                    showSearch
                                    filterOption={false}
                                    onSearch={fetchPoiOptions}
                                    onFocus={() => fetchPoiOptions()}
                                    options={poiOptions}
                                    value={filters.poi_id}
                                    onChange={v => {
                                        setFilters(prev => ({ ...prev, poi_id: v || null }))
                                        setPagination(prev => ({ ...prev, current: 1 }))
                                    }}
                                    loading={poiLoading}
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
                                    onChange={v => {
                                        setFilters(prev => ({ ...prev, status: v || null }))
                                        setPagination(prev => ({ ...prev, current: 1 }))
                                    }}
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
                    dataSource={rows}
                    loading={loading}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: pagination.total,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || prev.pageSize })),
                    }}
                    onChange={(p, _filters, sorterInfo) => {
                        const nextSorter = Array.isArray(sorterInfo) ? sorterInfo[0] : sorterInfo
                        setSorter({
                            field: nextSorter?.field as string | undefined,
                            order: nextSorter?.order as string | undefined,
                        })
                    }}
                />
            </div>

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

            <Modal
                title={`产品库存 - ${selectedProduct?.product_name}`}
                open={inventoryModalVisible}
                onCancel={() => {
                    setInventoryModalVisible(false)
                    setSelectedProduct(null)
                    setProductInventory([])
                }}
                footer={null}
                width={860}
            >
                <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ color: '#666' }}>查询范围</span>
                    <Select
                        value={String(inventoryDays)}
                        onChange={(v) => {
                            setInventoryDays(Number(v))
                        }}
                        options={[
                            { value: '30', label: '未来30天' },
                            { value: '90', label: '未来90天' },
                            { value: '180', label: '未来半年' },
                        ]}
                        style={{ width: 160 }}
                    />
                    <Button
                        onClick={() => {
                            if (!selectedProduct) return
                            setLoadingInventory(true)
                            const params = new URLSearchParams()
                            const [startDate, endDate] = buildInventoryRange(inventoryDays)
                            params.append('start_date', startDate)
                            params.append('end_date', endDate)
                            apiRequest<{ items: { date: string, available_qty: number }[] }>(
                                `/api/products/${selectedProduct.id}/inventory?${params.toString()}`
                            )
                                .then((res) => setProductInventory(res.items || []))
                                .catch(() => {
                                    message.error('加载库存失败')
                                    setProductInventory([])
                                })
                                .finally(() => setLoadingInventory(false))
                        }}
                    >
                        刷新
                    </Button>
                </div>
                {loadingInventory ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
                ) : (
                    <div>
                        <p style={{ color: '#666', marginBottom: 16 }}>
                            产品库存由资源库存自动计算得出（产品库存 = MIN(资源库存 / 资源用量)）
                        </p>
                        <ProductStockPreviewCalendar
                            stockData={productInventory.reduce((acc, curr) => {
                                acc[curr.date] = curr.available_qty
                                return acc
                            }, {} as Record<string, number>)}
                        />
                    </div>
                )}
            </Modal>
        </div>
    )
}
