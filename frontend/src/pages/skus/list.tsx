import { useState, useRef, useMemo, useEffect } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, message, Card, Row, Col, Popconfirm, Tooltip } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
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
    const { data, refresh } = useData()
    const skus = data?.skus ?? []
    const products = data?.products ?? []
    const channels = data?.channels ?? []
    const poiList = data?.poi ?? []
    const productResources = data?.product_resources ?? []
    const resources = data?.resources ?? []
    const suppliers = data?.suppliers ?? []
    const [modalVisible, setModalVisible] = useState(false)
    const [editingSku, setEditingSku] = useState<SKU | null>(null)
    const [form] = Form.useForm()


    const [batchUpdateForm] = Form.useForm()
    const calendarEditorRef = useRef<SKUCalendarEditorRef>(null)

    const [viewMode, setViewMode] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

    // Global Filter State
    const [filters, setFilters] = useState({
        keyword: '',
        product_id: null as string | null,
        status: null as string | null,
        poi_id: null as string | null,
    })

    // Filter Logic
    const filteredSkus = useMemo(() => {
        return skus.filter((item) => {
            // Keyword
            if (filters.keyword && !item.sku_name.toLowerCase().includes(filters.keyword.toLowerCase())) {
                return false
            }
            // Product
            if (filters.product_id && String(item.product_id) !== String(filters.product_id)) {
                return false
            }
            // Status
            if (filters.status && item.status !== filters.status) {
                return false
            }
            // POI (via Product)
            if (filters.poi_id) {
                const p = products.find(x => String(x.id) === String(item.product_id))
                if (!p || String(p.poi_id) !== String(filters.poi_id)) {
                    return false
                }
            }
            return true
        })
    }, [skus, filters, products])



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

            // Ensure SKU-Channel 绑定存在（单渠道模式，使用/sku_channels维护绑定）
            if (selectedChannelId) {
                const existingBinding = (data?.sku_channels || []).find((sc: any) => String(sc.sku_id) === String(savedSkuId));
                if (existingBinding) {
                    if (String(existingBinding.channel_id) !== String(selectedChannelId)) {
                        await apiRequest(`/api/sku_channels/${existingBinding.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ channel_id: Number(selectedChannelId) })
                        });
                    }
                } else {
                    await apiRequest('/api/sku_channels', {
                        method: 'POST',
                        body: JSON.stringify({ sku_id: savedSkuId, channel_id: Number(selectedChannelId), status: 'active' })
                    });
                }
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

    const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
    const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>()
    const [channelStockLimitMap, setChannelStockLimitMap] = useState<Record<string, number>>({})

    // Effect: Fetch product inventory and calculate limits when product/channel changes
    useEffect(() => {
        const fetchLimits = async () => {
            if (!selectedProductId || !selectedChannelId) {
                setChannelStockLimitMap({})
                return
            }

            const product = products.find(p => String(p.id) === String(selectedProductId))
            const channel = channels.find(c => String(c.id) === String(selectedChannelId))

            if (!product || !channel) return

            // Find ratio
            const allocations = product.allowed_channels || []
            const allocation = allocations.find((a: any) => String(a.channel_id || a) === String(selectedChannelId))
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
    }, [selectedProductId, selectedChannelId, products, channels])



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

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            await apiRequest('/api/skus/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`已删除 ${selectedRowKeys.length} 个SKU`)
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
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
    }

    const openModal = (record: SKU | null, mode: 'create' | 'edit' | 'view') => {
        setEditingSku(record)
        setViewMode(mode === 'view')

        if (record) {
            setSelectedProductId(String(record.product_id))
            // 通过 sku_channels 绑定获取渠道（SKU 表本身没有 channel_id）
            const binding = (data?.sku_channels || []).find((sc: any) => String(sc.sku_id) === String(record.id))
            const channelId = binding ? binding.channel_id : undefined
            setSelectedChannelId(channelId ? String(channelId) : undefined)

            form.setFieldsValue({
                name: record.sku_name,
                product_id: record.product_id,
                status: record.status,
                channel_id: channelId,
            })
        } else {
            setSelectedProductId(undefined)
            setSelectedChannelId(undefined)
            form.resetFields()
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
            title: '所属区域 (POI)',
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
        if (!selectedChannelId) return null;
        return channels.find(c => String(c.id) === String(selectedChannelId));
    }, [selectedChannelId, channels]);

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

    return (
        <div className="page-container">
            {/* ... header ... */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">SKU 管理 (M4)</h1>
                    <p className="page-subtitle">SKU 与渠道管理</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null, 'create')}>
                    新建 SKU
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
                                    onChange={e => setFilters({ ...filters, keyword: e.target.value })}
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
                                    onChange={v => setFilters({ ...filters, product_id: v })}
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
                                    options={poiList.map(p => ({ value: p.id, label: p.poi_name }))}
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
                                    options={Object.keys(STATUS_MAP).map(k => ({ value: k, label: STATUS_MAP[k].label }))}
                                    value={filters.status}
                                    onChange={v => setFilters({ ...filters, status: v })}
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
                    dataSource={filteredSkus.slice((pagination.current - 1) * pagination.pageSize, pagination.current * pagination.pageSize)}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: filteredSkus.length,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                    }}
                    onChange={(p) => setPagination({ current: p.current || 1, pageSize: p.pageSize || 10 })}
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
                            <Form.Item name="product_id" label="关联产品" rules={[{ required: true, message: '请选择产品' }]}>
                                <Select
                                    placeholder="选择产品"
                                    showSearch
                                    optionFilterProp="label"
                                    options={products.map((p) => ({ value: p.id, label: p.product_name }))}
                                    onChange={(v) => setSelectedProductId(v)}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="channel_id" label="销售渠道" rules={[{ required: true, message: '请选择渠道' }]}>
                                <Select
                                    placeholder="选择渠道"
                                    showSearch
                                    optionFilterProp="label"
                                    options={availableChannels.map((c: any) => ({ value: c.id, label: c.channel_name }))}
                                    onChange={(v) => setSelectedChannelId(v)}
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
                        <Card size="small" title="产品资源组成" style={{ marginBottom: 24 }}>
                            <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
                                💡 点击行左侧箭头可展开查看资源详细信息（景区、酒店、餐饮、交通等特定字段）
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
                                            return <div style={{ padding: 16, color: '#999' }}>加载资源信息...</div>
                                        }
                                        return <ResourceDetailsPanel resource={resource} />
                                    },
                                    rowExpandable: (record) => !!resources.find(x => String(x.id) === String(record.resource_id)),
                                }}
                                columns={[
                                    {
                                        title: '资源名称',
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
                                        render: (_, r) => suppliers.find(s => String(s.id) === String(r.supplier_id))?.supplier_name || '-'
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
                            channelId={selectedChannelId ? Number(selectedChannelId) : undefined}
                            stockLimitData={channelStockLimitMap}
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
