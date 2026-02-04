import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, message, Card, Row, Col, Popconfirm, Tooltip } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PlusOutlined, SearchOutlined, EyeOutlined, DeleteOutlined, SettingOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { SKU } from '@/types'
import SKUCalendarEditor from '@/components/SKUCalendarEditor';
import type { SKUCalendarEditorRef } from '@/components/SKUCalendarEditor';
import ResourceDetailsPanel from '@/components/ResourceDetailsPanel'

// SKU状态中文映射
const STATUS_MAP: Record<string, { label: string; color: string }> = {
    'draft': { label: '草稿', color: 'default' },
    'active': { label: '上架', color: 'green' },
    'offline': { label: '下架', color: 'orange' },
    'archived': { label: '已归档', color: 'gray' },
}

export default function SKUListPage() {
    const { data, loadData } = useData()
    const products = data?.products ?? []
    const channels = data?.channels ?? []
    const poiList = data?.poi ?? []
    const productResources = data?.product_resources ?? []
    const resources = data?.resources ?? []
    const suppliers = data?.suppliers ?? []
    const spus = data?.spus ?? []
    const [modalVisible, setModalVisible] = useState(false)
    const [editingSku, setEditingSku] = useState<SKU | null>(null)
    const [form] = Form.useForm()


    const [batchUpdateForm] = Form.useForm()
    const calendarEditorRef = useRef<SKUCalendarEditorRef>(null)

    const [viewMode, setViewMode] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
    const [rows, setRows] = useState<SKU[]>([])
    const [loading, setLoading] = useState(false)
    const [sorter, setSorter] = useState<{ field?: string; order?: string }>({})

    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const spuIdParam = searchParams.get('spu_id')

    // Global Filter State
    const [filters, setFilters] = useState({
        keyword: '',
        product_id: null as string | null,
        status: null as string | null,
        poi_id: null as string | null,
        spu_id: spuIdParam,
    })

    const [keywordDebounced, setKeywordDebounced] = useState(filters.keyword)

    useEffect(() => {
        loadData(['products', 'channels', 'poi', 'product_resources', 'resources', 'suppliers', 'spus', 'sku_channels', 'approvals'])
    }, [loadData])

    useEffect(() => {
        const t = setTimeout(() => setKeywordDebounced(filters.keyword), 300)
        return () => clearTimeout(t)
    }, [filters.keyword])

    const fetchSkus = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
            })
            if (keywordDebounced.trim()) params.append('keyword', keywordDebounced.trim())
            if (filters.product_id) params.append('product_id', String(filters.product_id))
            if (filters.status) params.append('status', String(filters.status))
            if (filters.poi_id) params.append('poi_id', String(filters.poi_id))
            if (filters.spu_id) params.append('spu_id', String(filters.spu_id))
            if (sorter.field) params.append('sort_field', sorter.field)
            if (sorter.order) params.append('sort_order', sorter.order)

            const res = await apiRequest<{ items: SKU[]; pagination: { total: number } }>(`/api/skus?${params.toString()}`)
            setRows(res.items || [])
            setPagination(prev => ({ ...prev, total: res.pagination?.total || 0 }))
        } catch (err: any) {
            message.error(err.message || '加载SKU失败')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [filters.poi_id, filters.product_id, filters.spu_id, filters.status, keywordDebounced, pagination.current, pagination.pageSize, sorter.field, sorter.order])

    useEffect(() => {
        fetchSkus()
    }, [fetchSkus])



    const handleSaveSKU = async (values: any) => {
        try {
            // Map form values to API payload
            const payload = {
                sku_name: values.name,
                spu_id: Number(values.spu_id),
                product_id: values.product_id,
                status: values.status,
            }


            let savedSkuId: number;
            const nextChannelIds = (values.channel_ids || []).map((id: any) => Number(id));

            if (editingSku) {
                // Update existing
                // Optimization: Update existing only if changed
                const isChanged =
                    editingSku.sku_name !== payload.sku_name ||
                    String(editingSku.product_id) !== String(payload.product_id) ||
                    editingSku.status !== payload.status;

                if (isChanged) {
                    await apiRequest(`/api/skus/${editingSku.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify(payload),
                    })
                }
                savedSkuId = Number(editingSku.id);
            } else {
                // Create new
                const res = await apiRequest('/api/skus', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                }) as { id: number }
                savedSkuId = res.id;
            }

            // Sync SKU-Channel bindings
            const existingBindings = (data?.sku_channels || []).filter((sc: any) => String(sc.sku_id) === String(savedSkuId));
            const existingByChannel = new Map(existingBindings.map((sc: any) => [String(sc.channel_id), sc]));
            const selectedSet = new Set(nextChannelIds.map((id: number) => String(id)));

            for (const binding of existingBindings) {
                if (!selectedSet.has(String(binding.channel_id))) {
                    await apiRequest(`/api/sku_channels/${binding.id}`, { method: 'DELETE' });
                } else if (binding.status && binding.status !== 'active') {
                    await apiRequest(`/api/sku_channels/${binding.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'active' })
                    });
                }
            }
            for (const channelId of selectedSet) {
                if (!existingByChannel.has(String(channelId))) {
                    await apiRequest('/api/sku_channels', {
                        method: 'POST',
                        body: JSON.stringify({ sku_id: savedSkuId, channel_id: Number(channelId), status: 'active' })
                    });
                }
            }

            // Save inventory/prices if any
            if (calendarEditorRef.current) {
                await calendarEditorRef.current.saveToBackend(savedSkuId, activeChannelId ? Number(activeChannelId) : undefined)
            }

            message.success(editingSku ? 'SKU更新成功' : 'SKU创建成功')
            setModalVisible(false)
            setEditingSku(null)
            form.resetFields()
            await fetchSkus()
            await loadData(['sku_channels', 'approvals'], { force: true })
        } catch (err: any) {
            message.error(err.message || (editingSku ? '更新失败' : '创建失败'))
        }
    }

    const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
    const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([])
    const [activeChannelId, setActiveChannelId] = useState<string | undefined>()
    const [channelStockLimitMap, setChannelStockLimitMap] = useState<Record<string, number>>({})

    // Effect: Fetch product inventory and calculate limits when product/channel changes
    useEffect(() => {
        const fetchLimits = async () => {
            if (!selectedProductId || !activeChannelId) {
                setChannelStockLimitMap({})
                return
            }

            const product = products.find(p => String(p.id) === String(selectedProductId))
            const channel = channels.find(c => String(c.id) === String(activeChannelId))

            if (!product || !channel) return

            // Find ratio
            const allocations = product.allowed_channels || []
            const allocation = allocations.find((a: any) => String(a.channel_id || a) === String(activeChannelId))
            // If allocation object exists, use stock_ratio, otherwise if it's just an ID in list (legacy), assume 100% or 0%? 
            // In new system, it's object. If stock_ratio is 0 or undefined, maybe treat as 0 limit? 
            // But let's assume if it is allowed, and ratio is missing, it might mean "unlimited" (or 100%). 
            // However, user requirement says: "stock * ratio". 
            // Let's safe default to 0 if not found, or maybe 100 if ratio is null?
            // "占比为0表示不分配，留空表示不限制该渠道" (from product editor text).
            // So if ratio is null/undefined, treat as 100%. 

            let ratio = 100
            if (allocation && typeof allocation === 'object') {
                if (allocation.stock_ratio !== undefined && allocation.stock_ratio !== null) {
                    ratio = Number(allocation.stock_ratio)
                } else {
                    // "留空表示不限制"(100%)
                    ratio = 100
                }
            } else if (allocation) {
                // Legacy ID only
                ratio = 100
            } else {
                // Not allowed?
                ratio = 0
            }

            if (ratio === 0) {
                // All 0
                // We can't really set infinite map, so we'll just not show anything or show 0?
                // But we need dates. We still need to fetch product inventory to know DATES.
            }

            try {
                // Fetch product daily inventory
                // Use the new /inventory endpoint that allows optional dates (defaults to 2 years)
                const res = await apiRequest<{ items: { date: string, available_qty: number }[] }>(
                    `/api/products/${selectedProductId}/inventory`
                )

                const limitMap: Record<string, number> = {}
                res.items.forEach(item => {
                    if (item.available_qty > 0) {
                        const limit = Math.floor(item.available_qty * (ratio / 100))
                        limitMap[item.date] = limit
                    } else {
                        limitMap[item.date] = 0
                    }
                })
                setChannelStockLimitMap(limitMap)

            } catch (err) {
                console.error("Failed to fetch product limits", err)
            }
        }
        fetchLimits()
    }, [selectedProductId, activeChannelId, products, channels])



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
                    await fetchSkus()
            await loadData(['sku_channels', 'approvals'], { force: true })
                } catch (err: any) {
                    message.error(err.message || '删除失败')
                }
            },
        })
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            await apiRequest('/api/skus/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`已删除 ${selectedRowKeys.length} 个SKU`)
            setSelectedRowKeys([])
            await fetchSkus()
            await loadData(['sku_channels', 'approvals'], { force: true })
        } catch (err: any) {
            message.error(err.message || '批量删除失败')
        }
    }

    const handleBatchUpdate = async (values: any) => {
        if (selectedRowKeys.length === 0) return
        try {
            const fields: any = {}
            if (values.status) fields.status = values.status
            // We can extend this for other fields later if needed

            if (Object.keys(fields).length === 0) {
                message.warning('请至少输入一个要修改的字段')
                return
            }

            await apiRequest('/api/skus/batch-update', {
                method: 'POST',
                body: JSON.stringify({
                    ids: selectedRowKeys,
                    fields
                })
            })
            message.success(`已更新 ${selectedRowKeys.length} 个SKU`)
            setBatchUpdateVisible(false)
            batchUpdateForm.resetFields()
            setSelectedRowKeys([])
            await fetchSkus()
            await loadData(['sku_channels', 'approvals'], { force: true })
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
    }

    const openModal = (record: SKU | null, mode: 'create' | 'edit' | 'view') => {
        setEditingSku(record)
        setViewMode(mode === 'view')

        if (record) {
            setSelectedProductId(String(record.product_id))
            // Use sku_channels to load channel_ids for the SKU
            const bindings = (data?.sku_channels || []).filter((sc: any) => String(sc.sku_id) === String(record.id))
            const channelIds = bindings.map((sc: any) => Number(sc.channel_id))
            const channelIdStrings = channelIds.map((id: number) => String(id))
            const nextActive = channelIdStrings.length > 0 ? channelIdStrings[0] : undefined
            setSelectedChannelIds(channelIdStrings)
            setActiveChannelId(nextActive)

            form.setFieldsValue({
                name: record.sku_name,
                spu_id: record.spu_id,
                product_id: record.product_id,
                status: record.status,
                channel_ids: channelIds,
            })
        } else {
            setSelectedProductId(undefined)
            setSelectedChannelIds([])
            setActiveChannelId(undefined)
            form.resetFields()
            // Default SPU if filtered
            if (filters.spu_id) {
                form.setFieldValue('spu_id', Number(filters.spu_id))
            }
        }
        setModalVisible(true)
    }


    // ... (keep handleSaveSKU, startEdit, handleDelete)

    const columns: any = [
        {
            title: 'SKU 名称',
            dataIndex: 'sku_name',
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
            onFilter: (value: string, record: SKU) =>
                record.sku_name.toLowerCase().includes(value.toLowerCase()),
            sorter: (a: SKU, b: SKU) => a.sku_name.localeCompare(b.sku_name),
        },
        {
            title: '关联产品',
            dataIndex: 'product_id',
            render: (v: string) => products.find((p) => String(p.id) === String(v))?.product_name || '-',
            filters: products.map(p => ({ text: p.product_name, value: p.id })),
            onFilter: (value: string, record: SKU) => String(record.product_id) === String(value),
        },
        {
            title: '所属资源',
            dataIndex: 'poi_id',
            render: (_: any, record: SKU) => {
                // Sourced from product -> poi_id only per user request
                const p = products.find(x => String(x.id) === String(record.product_id))
                return poiList.find((x) => String(x.id) === String(p?.poi_id))?.poi_name || '-'
            },
            filters: poiList.map(p => ({ text: p.poi_name, value: p.id })),
            onFilter: (value: string, record: SKU) => {
                const p = products.find(x => String(x.id) === String(record.product_id))
                return String(p?.poi_id) === String(value)
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => {
                const status = STATUS_MAP[v] || { label: v, color: 'default' }
                return <Tag color={status.color}>{status.label}</Tag>
            },
            filters: Object.keys(STATUS_MAP).map(k => ({ text: STATUS_MAP[k].label, value: k })),
            onFilter: (value: string, record: SKU) => record.status === value,
            sorter: (a: SKU, b: SKU) => a.status.localeCompare(b.status),
        },
        {
            title: '最后更新时间',
            dataIndex: 'updated_at',
            render: (v: string) => v ? new Date(v).toLocaleString() : '-',
            sorter: (a: SKU, b: SKU) => new Date(a.updated_at || '').getTime() - new Date(b.updated_at || '').getTime(),
        },
        {
            title: '操作',
            render: (_: any, record: SKU) => {
                const isLocked = record.status === 'active'

                // Check pending approvals
                const hasPending = data?.approvals?.some(a =>
                    a.object_type === 'sku' &&
                    String(a.object_id) === String(record.id) &&
                    a.status === 'pending'
                )

                return (
                    <Space>
                        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openModal(record, 'view')}>查看</Button>
                        <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => openModal(record, 'edit')}>编辑</Button>
                        {hasPending ? (
                            <Button
                                type="primary"
                                size="small"
                                ghost
                                onClick={() => message.info('已通知管理员尽快审批')}
                            >
                                催一催
                            </Button>
                        ) : (
                            isLocked ? (
                                <Tooltip title="SKU处于上架状态，不可删除">
                                    <Button type="link" size="small" danger disabled icon={<DeleteOutlined />}>删除</Button>
                                </Tooltip>
                            ) : (
                                <Popconfirm title="确定删除此SKU吗？" onConfirm={() => handleDelete(Number(record.id))}>
                                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                                </Popconfirm>
                            )
                        )}
                    </Space>
                )
            },
        },
    ]

    // Helper to get product details
    const selectedProduct = useMemo(() => {
        if (!selectedProductId) return null;
        return products.find(p => String(p.id) === String(selectedProductId));
    }, [selectedProductId, products]);

    // Helper to get channel details
    const selectedChannel = useMemo(() => {
        if (!activeChannelId) return null;
        return channels.find(c => String(c.id) === String(activeChannelId));
    }, [activeChannelId, channels]);

    const selectedChannelOptions = useMemo(() => {
        return selectedChannelIds.map((id) => {
            const channel = channels.find(c => String(c.id) === String(id))
            return { value: id, label: channel?.channel_name || id }
        })
    }, [selectedChannelIds, channels]);

    // Filter available channels based on product's allowed_channels
    const availableChannels = useMemo(() => {
        if (!selectedProduct) return channels;
        const allowed = selectedProduct.allowed_channels;
        if (!allowed || allowed.length === 0) return channels; // No restriction if empty

        // Filter valid IDs
        const allowedSet = new Set(allowed.map((a: any) => String(a.channel_id || a))); // Handle both object (new format) and potential legacy ID list
        return channels.filter(c => allowedSet.has(String(c.id)));
    }, [selectedProduct, channels]);

    // Get Product Resources for display
    const currentProductResources = useMemo(() => {
        if (!selectedProductId) return [];
        return productResources.filter(pr => String(pr.product_id) === String(selectedProductId));
    }, [selectedProductId, productResources]);

    const currentSpu = useMemo(() => {
        if (!spuIdParam) return null
        return spus.find(s => String(s.id) === String(spuIdParam))
    }, [spuIdParam, spus])

    const renderProductSuppliers = (record: any) => {
        const mode = record?.supplier_mode || 'auto'
        if (mode === 'auto') {
            return <Tag color="default">自动(最低价)</Tag>
        }
        const ids: Array<string | number> = (record?.supplier_ids && record.supplier_ids.length > 0)
            ? record.supplier_ids
            : (record?.supplier_id ? [record.supplier_id] : [])
        if (!ids.length) {
            return <Tag color="default">未指定</Tag>
        }
        return (
            <Space size={[4, 4]} wrap>
                {ids.map((id) => {
                    const supplier = suppliers.find(s => String(s.id) === String(id))
                    const label = supplier?.supplier_name || `ID:${id}`
                    return <Tag key={String(id)}>{label}</Tag>
                })}
            </Space>
        )
    }

    return (
        <div className="page-container">
            {/* ... header ... */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {spuIdParam && (
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={() => navigate('/spus/list')}
                            type="text"
                            style={{ fontSize: '18px' }}
                        />
                    )}
                    <div>
                        <h1 className="page-title">
                            {currentSpu ? `${currentSpu.name}` : 'SKU 管理 (M4)'}
                        </h1>
                        <p className="page-subtitle">
                            {currentSpu ? `所属 SPU: ${currentSpu.name} / ${currentSpu.spu_code || ''}` : 'SKU 与渠道管理'}
                        </p>
                    </div>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null, 'create')}>
                    {currentSpu ? '在该 SPU 下新建 SKU' : '新建 SKU'}
                </Button>
            </div>

            {/* Global Filters */}
            <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '16px' } }}>
                <Form layout="inline" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]} style={{ width: '100%' }}>
                        <Col span={6}>
                            <Form.Item label="关键词" style={{ marginBottom: 0, width: '100%' }}>
                                <Input
                                    placeholder="搜索SKU名称"
                                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                    value={filters.keyword}
                                    onChange={(e) => {
                                        setFilters({ ...filters, keyword: e.target.value })
                                        setPagination((prev) => ({ ...prev, current: 1 }))
                                    }}
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="关联产品" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部产品"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    options={products.map(p => ({ value: p.id, label: p.product_name }))}
                                    value={filters.product_id}
                                    onChange={(v) => {
                                        setFilters({ ...filters, product_id: v })
                                        setPagination((prev) => ({ ...prev, current: 1 }))
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="资源区域" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部区域"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    options={poiList.map(p => ({ value: p.id, label: p.poi_name }))}
                                    value={filters.poi_id}
                                    onChange={(v) => {
                                        setFilters({ ...filters, poi_id: v })
                                        setPagination((prev) => ({ ...prev, current: 1 }))
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="状态" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部状态"
                                    allowClear
                                    options={Object.keys(STATUS_MAP).map(k => ({ value: k, label: STATUS_MAP[k].label }))}
                                    value={filters.status}
                                    onChange={(v) => {
                                        setFilters({ ...filters, status: v })
                                        setPagination((prev) => ({ ...prev, current: 1 }))
                                    }}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={24} style={{ textAlign: 'right', marginTop: 16 }}>
                            {selectedRowKeys.length > 0 && (
                                <Space>
                                    <Button onClick={() => setBatchUpdateVisible(true)} icon={<SettingOutlined />}>
                                        批量修改
                                    </Button>
                                    <Tag color="blue">已选 {selectedRowKeys.length} 项</Tag>
                                    <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                                        批量删除
                                    </Button>
                                </Space>
                            )}
                        </Col>
                    </Row>
                </Form>
            </Card>

            <div className="glass-card" style={{ padding: '24px', marginTop: 16 }}>
                <Table<SKU>
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
                    }}
                    onChange={(p, _filters, sorterInfo) => {
                        setPagination(prev => ({ ...prev, current: p.current || 1, pageSize: p.pageSize || prev.pageSize }))
                        const nextSorter = Array.isArray(sorterInfo) ? sorterInfo[0] : sorterInfo
                        setSorter({
                            field: nextSorter?.field as string | undefined,
                            order: nextSorter?.order as string | undefined,
                        })
                    }}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                />
            </div>

            <Modal
                title={viewMode ? "查看 SKU" : (editingSku ? "编辑 SKU" : "创建 SKU")}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false)
                    setEditingSku(null)
                    form.resetFields()
                }}
                footer={null}
                width={1100}
            >
                <Form form={form} layout="vertical" onFinish={handleSaveSKU} disabled={viewMode}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="spu_id" label="所属SPU" rules={[{ required: true, message: '请选择SPU' }]}>
                                <Select
                                    placeholder="选择SPU"
                                    showSearch
                                    optionFilterProp="label"
                                    options={spus.map(s => ({ value: Number(s.id), label: s.name }))}
                                    disabled={!!filters.spu_id} // Disable if pre-filtered
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="product_id" label="关联产品" rules={[{ required: true, message: '请选择产品' }]}>
                                <Select
                                    placeholder="选择产品"
                                    showSearch
                                    optionFilterProp="label"
                                    options={products.map((p) => ({ value: p.id, label: p.product_name }))}
                                    onChange={(v) => {
                                        setSelectedProductId(v)
                                        setSelectedChannelIds([])
                                        setActiveChannelId(undefined)
                                        form.setFieldValue('channel_ids', [])
                                    }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="channel_ids" label="销售渠道" rules={[{ required: true, message: '请选择销售渠道' }]}>
                                <Select
                                    mode="multiple"
                                    placeholder="选择销售渠道"
                                    showSearch
                                    optionFilterProp="label"
                                    options={availableChannels.map((c: any) => ({ value: c.id, label: c.channel_name }))}
                                    onChange={(values) => {
                                        const ids = (values || []).map((v: any) => String(v))
                                        setSelectedChannelIds(ids)
                                        if (!ids.includes(activeChannelId || '')) {
                                            setActiveChannelId(ids[0])
                                        }
                                    }}
                                />
                            </Form.Item>
                            <Form.Item label="价格/库存编辑渠道">
                                <Select
                                    placeholder="选择价格/库存渠道"
                                    value={activeChannelId}
                                    disabled={selectedChannelIds.length === 0}
                                    options={selectedChannelOptions}
                                    onChange={(v) => setActiveChannelId(v)}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="name" label="SKU名称" rules={[{ required: true, message: '请输入SKU名称' }]}>
                                <Input placeholder="例如：北京三日游-标准版" />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Info Block */}
                    {(selectedProduct || selectedChannel) && (
                        <Card size="small" style={{ marginBottom: 24, background: '#f5f5f5' }}>
                            <Space size="large" split={<div style={{ width: 1, height: 20, background: '#ccc' }} />}>
                                {selectedProduct && (
                                    <>
                                        <div>
                                            <div style={{ fontSize: 12, color: '#666' }}>建议零售价</div>
                                            <div style={{ fontWeight: 'bold' }}>¥{selectedProduct.suggested_price || '-'}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 12, color: '#666' }}>基础成本</div>
                                            <div style={{ fontWeight: 'bold', color: '#cf1322' }}>¥{selectedProduct.base_cost || '-'}</div>
                                        </div>
                                    </>
                                )}
                                {selectedChannel && (
                                    <div>
                                        <div style={{ fontSize: 12, color: '#666' }}>渠道费率</div>
                                        <div style={{ fontWeight: 'bold' }}>
                                            {selectedChannel.commission_rate
                                                ? `${(Number(selectedChannel.commission_rate) * 100).toFixed(2)}%`
                                                : '无'}
                                        </div>
                                    </div>
                                )}
                            </Space>
                        </Card>
                    )}

                    {/* Product Composition Block */}
                    {selectedProduct && currentProductResources.length > 0 && (
                        <Card size="small" title="产品子资源组成" style={{ marginBottom: 24 }}>
                            <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
                                💡 点击行左侧箭头可展开查看子资源详细信息（景区、酒店、餐饮、交通等特定字段）
                            </div>
                            <Table
                                rowKey="id"
                                dataSource={currentProductResources}
                                pagination={false}
                                size="small"
                                expandable={{
                                    expandedRowRender: (record) => {
                                        const resource = resources.find(x => String(x.id) === String(record.resource_id))
                                        if (!resource) {
                                            return <div style={{ padding: 16, color: '#999' }}>加载子资源信息...</div>
                                        }
                                        return <ResourceDetailsPanel resource={resource} />
                                    },
                                    rowExpandable: (record) => !!resources.find(x => String(x.id) === String(record.resource_id)),
                                }}
                                columns={[
                                    {
                                        title: '子资源名称',
                                        render: (_, r) => resources.find(x => String(x.id) === String(r.resource_id))?.resource_name || r.resource_id
                                    },
                                    {
                                        title: '类型',
                                        render: (_, r) => {
                                            const res = resources.find(x => String(x.id) === String(r.resource_id))
                                            return res ? <Tag>{res.resource_type}</Tag> : '-'
                                        }
                                    },
                                    {
                                        title: '供应商',
                                        render: (_, r) => renderProductSuppliers(r)
                                    },
                                    {
                                        title: '数量',
                                        dataIndex: 'quantity'
                                    }
                                ]}
                            />
                        </Card>
                    )}

                    <Row gutter={16}>
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
                        <SKUCalendarEditor
                            ref={calendarEditorRef}
                            skuId={editingSku?.id ? Number(editingSku.id) : undefined}
                            channelId={activeChannelId ? Number(activeChannelId) : undefined}
                            stockLimitData={channelStockLimitMap}
                            readonlyStock
                        />
                    </div>

                    {!viewMode && (
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
                    )}
                </Form>
            </Modal>

            {/* Batch Update Modal */}
            <Modal
                title={`批量修改已选的 ${selectedRowKeys.length} 个SKU`}
                open={batchUpdateVisible}
                onCancel={() => setBatchUpdateVisible(false)}
                footer={null}
            >
                <Form layout="vertical" form={batchUpdateForm} onFinish={handleBatchUpdate}>
                    <p style={{ color: '#999', marginBottom: 16 }}>
                        请填写需要修改的字段，留空则不修改
                    </p>
                    <Form.Item name="status" label="状态">
                        <Select options={Object.keys(STATUS_MAP).map(k => ({ value: k, label: STATUS_MAP[k].label }))} allowClear placeholder="批量修改状态" />
                    </Form.Item>
                    <Space style={{ float: 'right', marginTop: 16 }}>
                        <Button onClick={() => setBatchUpdateVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">
                            确认修改
                        </Button>
                    </Space>
                </Form>
            </Modal>
        </div >
    )
}
