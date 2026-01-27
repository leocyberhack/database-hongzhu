
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Form, Input, Button, Select, Card, Space, InputNumber, Switch, Table,
    Modal, Tag, Divider, Row, Col, Statistic, message, Spin, Radio, Empty
} from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import type { Resource, Product, Supplier, SupplierResource } from '@/types'
import ProductStockPreviewCalendar from '@/components/ProductStockPreviewCalendar'
import ResourceDetailsPanel from '@/components/ResourceDetailsPanel'

// const { Option } = Select
// const { TextArea } = Input

// -- Sub-components --

// Helper component for Stock Ratio Input with Confirm Button
const StockRatioInput = ({ value, onChange, disabled }: { value: number, onChange: (val: number) => void, disabled: boolean }) => {
    const [val, setVal] = useState<number>(value || 0)

    // Sync from parent if needed (e.g. initial load), but allow local editing
    useEffect(() => {
        setVal(value || 0)
    }, [value])

    const handleConfirm = () => {
        onChange(val)
        message.success('已更新占比')
    }

    return (
        <Space>
            <InputNumber
                min={0}
                max={100}
                value={val}
                disabled={disabled}
                onChange={(v) => setVal(Number(v))}
                onPressEnter={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleConfirm()
                }}
                style={{ width: 80 }}
                placeholder="0"
            />
            <span style={{ marginLeft: 4 }}>%</span>
            <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={handleConfirm}
                disabled={disabled}
            />
        </Space>
    )
}

// -- Resource Selector Modal (Server-Side Search) --
interface ResourceSelectorProps {
    visible: boolean
    onCancel: () => void
    onSelect: (selectedIds: string[]) => void
    existingIds: string[]
}

function ResourceSelector({ visible, onCancel, onSelect, existingIds }: ResourceSelectorProps) {
    const { data } = useData()
    const poiList = data?.poi ?? []
    const resourceTypes = ['景区', '酒店', '餐饮', '交通']
    const poiTypeOptions = ['全部', ...resourceTypes]

    const [list, setList] = useState<Resource[]>([])
    const [loading, setLoading] = useState(false)
    const [filterKw, setFilterKw] = useState('')
    const [poiKw, setPoiKw] = useState('')
    const [poiTypeFilter, setPoiTypeFilter] = useState<string>('全部')
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null)
    const [selectedType, setSelectedType] = useState<string>(resourceTypes[0])

    const filteredPoiList = useMemo(() => {
        let list = poiList
        if (poiTypeFilter !== '全部') {
            list = list.filter((p) => p.poi_type === poiTypeFilter)
        }
        if (!poiKw) return list
        const kw = poiKw.trim().toLowerCase()
        return list.filter((p) =>
            p.poi_name.toLowerCase().includes(kw) ||
            (p.poi_code || '').toLowerCase().includes(kw)
        )
    }, [poiList, poiKw, poiTypeFilter])

    const selectedPoi = useMemo(() => {
        if (!selectedPoiId) return null
        return poiList.find(p => String(p.id) === String(selectedPoiId)) || null
    }, [poiList, selectedPoiId])

    useEffect(() => {
        if (!visible) return
        if (filteredPoiList.length === 0) {
            setSelectedPoiId(null)
            return
        }
        const hasSelected = filteredPoiList.some(p => String(p.id) === String(selectedPoiId))
        if (!hasSelected) {
            setSelectedPoiId(String(filteredPoiList[0].id))
        }
    }, [visible, filteredPoiList, selectedPoiId])

    useEffect(() => {
        if (!visible) return
        if (selectedPoi?.poi_type && selectedPoi.poi_type !== selectedType) {
            setSelectedType(selectedPoi.poi_type)
        }
    }, [visible, selectedPoi, selectedType])

    // Debounce search or just search on enter/change
    useEffect(() => {
        if (!visible) return
        if (!selectedPoiId) {
            setList([])
            return
        }
        const fetchResources = async () => {
            setLoading(true)
            try {
                // Fetch page 1, size 50
                const qs = new URLSearchParams({
                    page: '1',
                    page_size: '50',
                })
                qs.append('poi_id', String(selectedPoiId))
                if (selectedType) qs.append('resource_type', selectedType)
                if (filterKw) qs.append('keyword', filterKw)

                const res = await apiRequest<{ items: Resource[] }>(`/api/resources?${qs.toString()}`)
                setList(res.items)
            } catch (err) {
                console.error(err)
                message.error('加载资源列表失败')
            } finally {
                setLoading(false)
            }
        }

        const timer = setTimeout(() => {
            fetchResources()
        }, 300)
        return () => clearTimeout(timer)
    }, [visible, filterKw, selectedPoiId, selectedType])

    useEffect(() => {
        if (!visible) return
        setSelectedIds([])
    }, [visible, selectedPoiId, selectedType])

    const columns = [
        { title: '资源名称', dataIndex: 'resource_name' },
        { title: '资源编码', dataIndex: 'resource_code' },
        { title: '类型', dataIndex: 'resource_type', render: (v: string) => <Tag>{v}</Tag> },
    ]

    return (
        <Modal
            title="选择要添加的资源（先选POI，再选资源类型）"
            open={visible}
            onCancel={onCancel}
            width={980}
            onOk={() => {
                onSelect(selectedIds)
                setSelectedIds([])
            }}
            confirmLoading={loading}
        >
            <Row gutter={16}>
                <Col span={7}>
                    <Space style={{ marginBottom: 12 }} size={8}>
                        <span style={{ fontSize: 12, color: '#666' }}>POI类型</span>
                        <Select
                            size="small"
                            value={poiTypeFilter}
                            onChange={(v) => setPoiTypeFilter(v)}
                            options={poiTypeOptions.map(t => ({ value: t, label: t }))}
                            style={{ width: 120 }}
                        />
                    </Space>
                    <Input
                        placeholder="搜索POI名称/编码"
                        prefix={<SearchOutlined />}
                        value={poiKw}
                        onChange={e => setPoiKw(e.target.value)}
                        allowClear
                        style={{ marginBottom: 12 }}
                    />
                    <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                        {filteredPoiList.length === 0 ? (
                            <Empty description="暂无POI" style={{ margin: '24px 0' }} />
                        ) : (
                            filteredPoiList.map((poi) => {
                                const isActive = String(poi.id) === String(selectedPoiId)
                                return (
                                    <div
                                        key={poi.id}
                                        onClick={() => setSelectedPoiId(String(poi.id))}
                                        style={{
                                            padding: '10px 12px',
                                            cursor: 'pointer',
                                            background: isActive ? '#f6ffed' : '#fff',
                                            borderBottom: '1px solid #f0f0f0',
                                        }}
                                    >
                                        <div style={{ fontWeight: 600 }}>{poi.poi_name}</div>
                                        <div style={{ fontSize: 12, color: '#999' }}>
                                            {poi.poi_code || '-'} · {poi.city}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </Col>
                <Col span={17}>
                    <Space style={{ marginBottom: 12 }} wrap>
                        <Radio.Group
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            optionType="button"
                            buttonStyle="solid"
                        >
                            {resourceTypes.map((t) => (
                                <Radio.Button
                                    key={t}
                                    value={t}
                                    disabled={selectedPoi?.poi_type ? t !== selectedPoi.poi_type : false}
                                >
                                    {t}
                                </Radio.Button>
                            ))}
                        </Radio.Group>
                        <Input
                            placeholder="搜索资源名称..."
                            prefix={<SearchOutlined />}
                            value={filterKw}
                            onChange={e => setFilterKw(e.target.value)}
                            allowClear
                        />
                    </Space>
                    {!selectedPoiId ? (
                        <Empty description="请先选择POI" style={{ marginTop: 60 }} />
                    ) : (
                        <Table
                            rowKey="id"
                            columns={columns}
                            dataSource={list}
                            loading={loading}
                            rowSelection={{
                                selectedRowKeys: selectedIds,
                                onChange: (keys) => setSelectedIds(keys as string[]),
                                getCheckboxProps: (record) => ({
                                    disabled: existingIds.includes(String(record.id)),
                                }),
                            }}
                            pagination={false}
                            size="small"
                            scroll={{ y: 360 }}
                        />
                    )}
                </Col>
            </Row>
        </Modal>
    )
}

// -- Category Manager Component --
// CategoryManager moved to separate page

// -- Main Page --
interface SelectedResourceItem {
    key: string // unique loop key
    resource_id: string
    supplier_id?: string
    quantity: number
    required_flag: boolean
    remark?: string

    // Display data (populated from maps)
    _resourceName?: string
    _resourceType?: string
}

export default function ProductEditorPage() {
    const { data, refresh } = useData()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const productId = searchParams.get('id')
    const isReadOnly = searchParams.get('readonly') === 'true'

    const [suggestedPrice, setSuggestedPrice] = useState<number>(0)
    const [form] = Form.useForm()
    const [items, setItems] = useState<SelectedResourceItem[]>([])
    const [modalVisible, setModalVisible] = useState(false)
    const [loading, setLoading] = useState(false)
    const [initLoading, setInitLoading] = useState(false)
    const [estimatedDailyStock, setEstimatedDailyStock] = useState<number | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewData, setPreviewData] = useState<Record<string, number>>({})
    const [, forceUpdate] = useState({})
    // Watch allowed_channels at the top level to avoid hook-in-loop error
    const watchedAllocations = Form.useWatch('allowed_channels', form) || []

    // Local caches for this page (to support specific ID fetching)
    const [resourceMap, setResourceMap] = useState<Record<string, Resource>>({})
    const [supplierMap, setSupplierMap] = useState<Record<string, Supplier>>({})
    const [supplierResourceMap, setSupplierResourceMap] = useState<Record<string, SupplierResource[]>>({}) // resource_id -> list of SRs

    const categories = data?.product_categories ?? []
    const channels = data?.channels ?? []

    // Helper to fetch data for specific resources (resource info -> supplier options -> supplier info)
    const fetchResourcesData = useCallback(async (resourceIds: string[]) => {
        if (resourceIds.length === 0) return

        try {
            // 1. Fetch Resources
            const rParams = new URLSearchParams()
            resourceIds.forEach(id => rParams.append('ids', id))
            rParams.append('page_size', '1000')

            const rRes = await apiRequest<{ items: Resource[] }>(`/api/resources?${rParams.toString()}`)
            const newResMap = { ...resourceMap }
            rRes.items.forEach(r => newResMap[r.id] = r)
            setResourceMap(prev => ({ ...prev, ...newResMap }))

            // 2. Fetch Helper: Available Suppliers for these resources
            const srParams = new URLSearchParams()
            resourceIds.forEach(id => srParams.append('resource_ids', id))
            srParams.append('page_size', '1000')

            const srRes = await apiRequest<{ items: SupplierResource[] }>(`/api/supplier-resources?${srParams.toString()}`)

            const newSRMap = { ...supplierResourceMap }
            const sIdsToFetch = new Set<string>()

            resourceIds.forEach(rid => newSRMap[rid] = [])

            srRes.items.forEach(sr => {
                const rid = String(sr.resource_id)
                if (!newSRMap[rid]) newSRMap[rid] = []
                newSRMap[rid].push(sr)
                sIdsToFetch.add(String(sr.supplier_id))
            })
            setSupplierResourceMap(prev => ({ ...prev, ...newSRMap }))

            // 3. Fetch Suppliers details
            if (sIdsToFetch.size > 0) {
                const sParams = new URLSearchParams()
                Array.from(sIdsToFetch).forEach(id => sParams.append('ids', id))
                sParams.append('page_size', '1000')

                const sRes = await apiRequest<{ items: Supplier[] }>(`/api/suppliers?${sParams.toString()}`)
                const newSupMap = { ...supplierMap }
                sRes.items.forEach(s => newSupMap[s.id] = s)
                setSupplierMap(prev => ({ ...prev, ...newSupMap }))
            }

        } catch (err) {
            console.error('Fetch resources data error', err)
            message.error('加载资源详情失败')
        }
    }, [])

    // Initialize data if editing
    useEffect(() => {
        const init = async () => {
            if (!productId) return
            setInitLoading(true)
            try {
                // 1. Fetch Product
                const p = await apiRequest<Product>(`/api/products/${productId}`)

                form.setFieldsValue({
                    product_name: p.product_name,
                    description: p.description,
                    status: p.status,
                    category_id: p.category_id,
                    suggested_price: p.suggested_price,
                    allowed_channels: p.allowed_channels,
                })
                setSuggestedPrice(p.suggested_price ? Number(p.suggested_price) : 0)

                // 2. Fetch Product Resources
                const prRes = await apiRequest<{ items: any[] }>(`/api/product-resources?product_id=${productId}`)
                const links = prRes.items

                // 3. Prepare items state
                const newItems = links.map((l, idx) => ({
                    key: `${l.resource_id}_${idx} `,
                    resource_id: String(l.resource_id),
                    supplier_id: l.supplier_id ? String(l.supplier_id) : undefined,
                    quantity: l.quantity,
                    required_flag: l.required_flag,
                    remark: l.remark,
                }))
                setItems(newItems)

                // 4. Fetch related data
                const rIds = Array.from(new Set(links.map((l: any) => String(l.resource_id))))
                await fetchResourcesData(rIds)

            } catch (err: any) {
                message.error(err.message || '加载产品详情失败')
            } finally {
                setInitLoading(false)
            }
        }
        init()
    }, [productId, form])

    // When adding new resources
    const handleAddResources = async (ids: string[]) => {
        const newItems = ids.map(id => ({
            key: `${id}_${Date.now()}_${Math.random()} `,
            resource_id: id,
            quantity: 1,
            required_flag: true,
            supplier_id: undefined
        }))
        setItems(prev => [...prev, ...newItems])
        setModalVisible(false)

        // Fetch data for new items
        await fetchResourcesData(ids)
    }

    // Effect: Preview Inventory when items change
    useEffect(() => {
        const fetchPreview = async () => {
            // Only preview if we have items and all have supplier_id
            const validItems = items.filter(i => i.resource_id && i.supplier_id)
            if (validItems.length === 0) {
                setEstimatedDailyStock(null)
                setPreviewData({})
                return
            }

            setPreviewLoading(true)
            try {
                // Determine overlaps for the next 2 years (backend default)
                // We don't send dates, so backend will find all overlaps from today onwards
                const payload = {
                    resources: validItems.map(i => ({
                        resource_id: Number(i.resource_id),
                        supplier_id: Number(i.supplier_id),
                        quantity: i.quantity
                    }))
                }

                const res = await apiRequest<{ items: { date: string, available_qty: number }[] }>('/api/products/inventory/preview', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                })

                // Create Map
                const newData: Record<string, number> = {}
                const stocks: number[] = []

                res.items.forEach(i => {
                    newData[i.date] = i.available_qty
                    // Only consider non-zero stocks for the "base capacity" calculation as requested
                    // "inventory not 0 time period"
                    if (i.available_qty > 0 && i.available_qty < 99999999) {
                        stocks.push(i.available_qty)
                    }
                })
                setPreviewData(newData)

                // Calculate Minimum Daily Stock (over non-zero days)
                if (stocks.length > 0) {
                    const minStock = Math.min(...stocks)
                    setEstimatedDailyStock(minStock)
                } else {
                    setEstimatedDailyStock(0)
                }
            } catch (err) {
                console.error("Inventory preview failed", err)
            } finally {
                setPreviewLoading(false)
            }
        }

        // Simple debounce
        const timer = setTimeout(fetchPreview, 1000)
        return () => clearTimeout(timer)
    }, [items])

    // Cost Calculation
    const totalCost = useMemo(() => {
        return items.reduce((sum, item) => {
            if (!item.resource_id || !item.supplier_id) return sum
            // Find price in supplierResourceMap
            const srs = supplierResourceMap[item.resource_id] || []
            const sr = srs.find(x => String(x.supplier_id) === String(item.supplier_id))
            const price = sr?.settlement_price || 0
            return sum + (Number(price) * item.quantity)
        }, 0)
    }, [items, supplierResourceMap])

    const handleSave = async (values: any) => {
        // Validate items
        for (const item of items) {
            if (!item.supplier_id) {
                message.error('请为所有资源选择供应商')
                return
            }
        }

        const payload = {
            ...values,
            base_cost: totalCost, // Pass calculated cost to backend
            structure_hash: `HASH_${Date.now()} `, // Simple mock hash
            resources: items.map(i => ({
                resource_id: i.resource_id,
                supplier_id: i.supplier_id,
                quantity: i.quantity,
                required_flag: i.required_flag,
                remark: i.remark
            }))
        }

        setLoading(true)
        try {
            if (productId) {
                await apiRequest(`/api/products/${productId}`, { method: 'PUT', body: JSON.stringify(payload) })
                message.success('产品更新成功')
            } else {
                await apiRequest('/api/products', { method: 'POST', body: JSON.stringify(payload) })
                message.success('产品创建成功')
            }
            await refresh() // Refresh global cache if needed
            navigate('/products/list')
        } catch (err: any) {
            message.error(err.message || '保存失败')
        } finally {
            setLoading(false)
        }
    }

    // Columns
    const itemColumns = [
        {
            title: '资源',
            dataIndex: 'resource_id',
            render: (rid: string) => {
                const r = resourceMap[rid]
                return (
                    <Space direction="vertical" size={0}>
                        <b>{r?.resource_name || rid}</b>
                        <Tag style={{ marginTop: 4 }}>{r?.resource_type}</Tag>
                    </Space>
                )
            }
        },
        {
            title: '供应商 (选择以计算成本)',
            width: 300,
            render: (_: any, record: SelectedResourceItem, index: number) => {
                const availSR = supplierResourceMap[record.resource_id] || []
                return (
                    <Select
                        style={{ width: '100%' }}
                        placeholder={availSR.length > 0 ? "选择供应商" : "无直连供应商"}
                        value={record.supplier_id ? String(record.supplier_id) : undefined}
                        onChange={(val) => {
                            const newItems = [...items]
                            newItems[index].supplier_id = val
                            setItems(newItems)
                        }}
                        disabled={isReadOnly}
                    >
                        {availSR.map(sr => {
                            const s = supplierMap[String(sr.supplier_id)]
                            return (
                                <Select.Option key={sr.supplier_id} value={String(sr.supplier_id)}>
                                    <Space>
                                        <span>{s?.supplier_name || sr.supplier_id}</span>
                                        <Tag color="gold">¥{sr.settlement_price}</Tag>
                                    </Space>
                                </Select.Option>
                            )
                        })}
                    </Select>
                )
            }
        },
        {
            title: '数量',
            width: 120,
            dataIndex: 'quantity',
            render: (qty: number, _: any, idx: number) => (
                <InputNumber min={1} value={qty} disabled={isReadOnly} onChange={v => {
                    const newItems = [...items]
                    newItems[idx].quantity = v || 1
                    setItems(newItems)
                }} />
            )
        },
        {
            title: '必须项',
            width: 80,
            dataIndex: 'required_flag',
            render: (flag: boolean, _: any, idx: number) => (
                <Switch size="small" checked={flag} disabled={isReadOnly} onChange={v => {
                    const newItems = [...items]
                    newItems[idx].required_flag = v
                    setItems(newItems)
                }} />
            )
        },
        {
            title: '操作',
            width: 60,
            render: (_: any, __: any, idx: number) => (
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => {
                    const newItems = [...items]
                    newItems.splice(idx, 1)
                    setItems(newItems)
                }} disabled={isReadOnly} />
            )
        }
    ]

    if (initLoading) {
        return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" tip="加载产品数据..." /></div>
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{productId ? '编辑产品' : '新建产品'}</h1>
                <p className="page-subtitle">组合资源构建产品，自动计算成本</p>
            </div>

            <Row gutter={24}>
                <Col span={16}>
                    <div className="glass-card" style={{ padding: '24px', marginBottom: 24 }}>
                        <Form layout="vertical" form={form} disabled={isReadOnly} onFinish={handleSave} onValuesChange={(changed) => {
                            if (changed.suggested_price !== undefined) {
                                setSuggestedPrice(changed.suggested_price)
                            }
                        }}>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="产品名称" name="product_name" rules={[{ required: true }]}>
                                        <Input placeholder="输入产品名称" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="产品分类" name="category_id">
                                        <Select
                                            placeholder="选择分类"
                                            allowClear
                                            options={categories.map(c => ({ value: c.id, label: c.name }))}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item label="产品描述" name="description">
                                <Input.TextArea rows={2} placeholder="输入描述" />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item label="建议零售价" name="suggested_price">
                                        <InputNumber style={{ width: '100%' }} prefix="¥" min={0} />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label="状态" name="status" initialValue="draft">
                                        <Select options={[
                                            { value: 'draft', label: '草稿' },
                                            { value: 'active', label: '上架' },
                                            { value: 'archived', label: '下架' }
                                        ]} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Divider>渠道库存配额</Divider>
                            <p style={{ color: '#666', marginBottom: 16 }}>
                                为每个渠道分配库存占比。占比为0表示不分配，留空表示不限制该渠道。占比总和不需要等于100%。
                            </p>

                            <Form.Item name="allowed_channels" noStyle>
                                <Table
                                    size="small"
                                    pagination={false}
                                    dataSource={channels.map(c => {
                                        const allocation = watchedAllocations.find(
                                            (a: any) => a?.channel_id === Number(c.id)
                                        )
                                        return {
                                            key: c.id,
                                            channel_id: Number(c.id),
                                            channel_name: c.channel_name,
                                            stock_ratio: allocation?.stock_ratio ?? 0
                                        }
                                    })}
                                    columns={[
                                        {
                                            title: '渠道名称',
                                            dataIndex: 'channel_name',
                                            width: '40%'
                                        },
                                        {
                                            title: '库存占比 (%)',
                                            dataIndex: 'stock_ratio',
                                            width: '40%',
                                            render: (_: any, record: any) => (
                                                <StockRatioInput
                                                    value={record.stock_ratio}
                                                    disabled={isReadOnly}
                                                    onChange={(val) => {
                                                        const currentAllocations = form.getFieldValue('allowed_channels') || []
                                                        const existingIdx = currentAllocations.findIndex(
                                                            (a: any) => a?.channel_id === record.channel_id
                                                        )
                                                        let newAllocations
                                                        if (existingIdx >= 0) {
                                                            newAllocations = [...currentAllocations]
                                                            newAllocations[existingIdx] = {
                                                                channel_id: record.channel_id,
                                                                stock_ratio: val ?? 0
                                                            }
                                                        } else {
                                                            newAllocations = [
                                                                ...currentAllocations,
                                                                { channel_id: record.channel_id, stock_ratio: val ?? 0 }
                                                            ]
                                                        }
                                                        form.setFieldsValue({ allowed_channels: newAllocations })
                                                        form.setFieldsValue({ allowed_channels: newAllocations })
                                                        // Force update to recalculate estimates
                                                        forceUpdate({})
                                                    }}
                                                />
                                            )
                                        },
                                        {
                                            title: '预计库存',
                                            width: '20%',
                                            render: (_: any, record: any) => {
                                                const ratio = record.stock_ratio || 0
                                                const estimated = estimatedDailyStock !== null
                                                    ? Math.floor(estimatedDailyStock * (ratio / 100))
                                                    : null

                                                if (ratio <= 0) return <span style={{ color: '#999' }}>未分配</span>

                                                return (
                                                    <Space>
                                                        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                                                            {estimated !== null ? estimated : '-'}
                                                        </span>
                                                        <span style={{ color: '#999', fontSize: 12 }}>(预估)</span>
                                                    </Space>
                                                )
                                            }
                                        }
                                    ]}
                                />
                            </Form.Item>

                            <Divider>资源组合</Divider>
                            <div style={{ marginBottom: 8, color: '#666', fontSize: 12 }}>
                                💡 点击行左侧箭头可展开查看资源详细信息（景区、酒店等特定字段）
                            </div>

                            <Table
                                rowKey="key"
                                columns={itemColumns}
                                dataSource={items}
                                pagination={false}
                                expandable={{
                                    expandedRowRender: (record: SelectedResourceItem) => {
                                        const resource = resourceMap[record.resource_id]
                                        if (!resource) {
                                            return <div style={{ padding: 16, color: '#999' }}>加载资源信息...</div>
                                        }
                                        return <ResourceDetailsPanel resource={resource} />
                                    },
                                    rowExpandable: (record) => !!resourceMap[record.resource_id],
                                }}
                                footer={() => !isReadOnly ? (
                                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                                        添加资源
                                    </Button>
                                ) : null}
                            />

                            <div style={{ marginTop: 24, padding: 16, background: '#f6f6f6', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Space size="large">
                                        <Statistic title="预估总成本" value={totalCost} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} />
                                        <Statistic
                                            title="理论利润"
                                            value={(suggestedPrice || 0) - totalCost}
                                            precision={2}
                                            prefix="¥"
                                            valueStyle={{ color: (suggestedPrice || 0) - totalCost >= 0 ? '#3f8600' : '#cf1322' }}
                                        />
                                        <div style={{ width: 1, height: 40, background: '#f0f0f0' }} />
                                        <Statistic
                                            title="周期内最小库存 (非0日)"
                                            value={estimatedDailyStock ?? '-'}
                                            valueStyle={{ color: '#1890ff' }}
                                            suffix={previewLoading ? <Spin size="small" /> : null}
                                        />
                                    </Space>
                                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>* 理论利润 = 建议零售价 - 预估总成本</div>

                                    <div style={{ marginTop: 24 }}>
                                        <div style={{ marginBottom: 8, fontWeight: 'bold' }}>库存日历预览 (有效供应期)</div>
                                        <div style={{ width: '100%', maxWidth: 800 }}>
                                            <ProductStockPreviewCalendar stockData={previewData} />
                                        </div>
                                    </div>
                                </div>
                                <Space>
                                    <Button size="large" onClick={() => navigate('/products/list')}>{isReadOnly ? '返回' : '取消'}</Button>
                                    {!isReadOnly && (
                                        <Button type="primary" size="large" htmlType="submit" loading={loading}>
                                            {productId ? '保存修改' : '立即创建'}
                                        </Button>
                                    )}
                                </Space>
                            </div>
                        </Form>
                    </div>

                    {/* Category Manager moved to separate page */}
                </Col>

                <Col span={8}>
                    <Card title="帮助指南" size="small" className="glass-card" bordered={false}>
                        <p>1. <b>分类管理</b>：请前往"产品管理 -&gt; 产品分类"建立分类。</p>
                        <p>2. <b>资源选择</b>：从资源库中选择景区、酒店等。</p>
                        <p>3. <b>供应商指定</b>：必须为每个资源指定供应商，以便系统计算成本和后续下单。</p>
                        <p>4. <b>成本计算</b>：成本 = Σ(资源数量 × 供应商结算价)。</p>
                    </Card>
                </Col>
            </Row>

            <ResourceSelector
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                onSelect={handleAddResources}
                existingIds={items.map(i => i.resource_id)}
            />
        </div>
    )
}
