
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Form, Input, Button, Select, Card, Space, InputNumber, Switch, Table,
    Modal, Tag, Divider, Row, Col, Statistic, message, Spin, Radio, Empty, Alert
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
    supplier_id?: string // deprecated
    supplier_mode?: 'auto' | 'locked'
    supplier_ids?: string[]
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

    // Product metadata (for edit mode info card)
    const [productMetadata, setProductMetadata] = useState<{
        id?: number
        product_name?: string
        created_at?: string
        updated_at?: string
        // created_by?: string
    } | null>(null)

    // Change tracking
    const [initialFormValues, setInitialFormValues] = useState<any>(null)
    const [initialItems, setInitialItems] = useState<SelectedResourceItem[]>([])
    const [changedFields, setChangedFields] = useState<Set<string>>(new Set())

    // Template copying (for create mode)
    const [templateModalVisible, setTemplateModalVisible] = useState(false)
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

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

                const formValues = {
                    product_name: p.product_name,
                    product_code: p.product_code,
                    description: p.description,
                    status: p.status,
                    category_id: p.category_id,
                    suggested_price: p.suggested_price,
                    allowed_channels: p.allowed_channels,
                }

                form.setFieldsValue(formValues)
                setSuggestedPrice(p.suggested_price ? Number(p.suggested_price) : 0)

                // Save metadata for info card
                setProductMetadata({
                    id: Number(p.id),
                    product_name: p.product_name,
                    created_at: p.created_at,
                    updated_at: p.updated_at,
                    // created_by not in type
                })

                // Save initial values for change tracking
                setInitialFormValues(formValues)

                // 2. Fetch Product Resources
                const prRes = await apiRequest<{ items: any[] }>(`/api/product-resources?product_id=${productId}`)
                const links = prRes.items

                // 3. Prepare items state
                const newItems = links.map((l, idx) => ({
                    key: `${l.resource_id}_${idx} `,
                    resource_id: String(l.resource_id),
                    supplier_mode: l.supplier_mode || 'auto',
                    supplier_ids: l.supplier_ids && l.supplier_ids.length > 0 ? l.supplier_ids.map(String) : (l.supplier_id ? [String(l.supplier_id)] : []),
                    quantity: l.quantity,
                    required_flag: l.required_flag,
                    remark: l.remark,
                }))
                setItems(newItems)
                setInitialItems(JSON.parse(JSON.stringify(newItems))) // Deep copy

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
        const newItems: SelectedResourceItem[] = ids.map(id => ({
            key: `${id}_${Date.now()}_${Math.random()} `,
            resource_id: id,
            quantity: 1,
            required_flag: true,
            supplier_mode: 'auto' as const,
            supplier_ids: []
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
            const validItems = items.filter(i => i.resource_id)
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
                        supplier_mode: i.supplier_mode,
                        supplier_ids: i.supplier_ids ? i.supplier_ids.map(Number) : [],
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

    // Cost Calculation (Estimate)
    const totalCost = useMemo(() => {
        return items.reduce((sum, item) => {
            if (!item.resource_id) return sum

            const srs = supplierResourceMap[item.resource_id] || []
            if (srs.length === 0) return sum

            let applicableSRs = srs
            if (item.supplier_mode === 'locked' && item.supplier_ids && item.supplier_ids.length > 0) {
                applicableSRs = srs.filter(sr => item.supplier_ids!.includes(String(sr.supplier_id)))
            }

            // Find lowest price among applicable suppliers
            let minPrice = 99999999
            let found = false
            applicableSRs.forEach(sr => {
                const p = Number(sr.settlement_price || 0)
                if (p < minPrice) minPrice = p
                found = true
            })

            const unitCost = found ? minPrice : 0
            return sum + (unitCost * item.quantity)
        }, 0)
    }, [items, supplierResourceMap])

    // Change tracking - Track which fields have been modified
    useEffect(() => {
        if (!productId || !initialFormValues) return // Only track in edit mode

        const currentValues = form.getFieldsValue()
        const changed = new Set<string>()

        // Compare form values
        Object.keys(initialFormValues).forEach(key => {
            const initial = initialFormValues[key]
            const current = currentValues[key]

            // Deep comparison for objects/arrays
            if (JSON.stringify(initial) !== JSON.stringify(current)) {
                changed.add(key)
            }
        })

        // Check if items (resources) changed
        if (JSON.stringify(initialItems) !== JSON.stringify(items)) {
            changed.add('resources')
        }

        setChangedFields(changed)
    }, [form, productId, initialFormValues, initialItems, items])
    // Helper to render label with change indicator
    const renderLabel = (label: string, fieldName: string) => {
        const hasChanged = changedFields.has(fieldName)
        return (
            <span>
                {label}
                {hasChanged && productId && (
                    <Tag color="orange" style={{ marginLeft: 8, fontSize: 10 }}>
                        已修改
                    </Tag>
                )}
            </span>
        )
    }

    const handleSave = async (values: any) => {
        // Validate items
        for (const item of items) {
            if (item.supplier_mode === 'locked' && (!item.supplier_ids || item.supplier_ids.length === 0)) {
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
                supplier_mode: i.supplier_mode,
                supplier_ids: i.supplier_ids ? i.supplier_ids.map(Number) : [],
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
            title: '供应商选择',
            width: 450,
            render: (_: any, record: SelectedResourceItem, index: number) => {
                const availSR = supplierResourceMap[record.resource_id] || []
                const mode = record.supplier_mode || 'auto'

                // Sort by price
                const sortedSR = [...availSR].sort((a, b) => Number(a.settlement_price) - Number(b.settlement_price))

                return (
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Space>
                            <Switch
                                checkedChildren="自动"
                                unCheckedChildren="锁定"
                                checked={mode === 'auto'}
                                onChange={(checked) => {
                                    const newItems = [...items]
                                    newItems[index].supplier_mode = checked ? 'auto' : 'locked'
                                    if (!checked && (!newItems[index].supplier_ids || newItems[index].supplier_ids!.length === 0)) {
                                        // Default to all suppliers when switching to locked mode
                                        newItems[index].supplier_ids = sortedSR.map(s => String(s.supplier_id))
                                    }
                                    setItems(newItems)
                                }}
                                disabled={isReadOnly}
                            />
                            <span style={{ fontSize: 12, color: '#999' }}>
                                {mode === 'auto' ? '自动选择最低价' : '从指定供应商中选择'}
                            </span>
                        </Space>

                        {mode === 'auto' ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {sortedSR.length === 0 && <Tag>无可用供应商</Tag>}
                                {sortedSR.map((sr, idx) => {
                                    const s = supplierMap[String(sr.supplier_id)]
                                    const isLowest = idx === 0
                                    return (
                                        <Tag key={sr.supplier_id} color={isLowest ? "success" : "default"}>
                                            {s?.supplier_name} ¥{sr.settlement_price}
                                            {isLowest && " ⭐"}
                                        </Tag>
                                    )
                                })}
                            </div>
                        ) : (
                            <div style={{ width: '100%' }}>
                                <Select
                                    mode="multiple"
                                    style={{ width: '100%' }}
                                    placeholder="点击选择供应商"
                                    value={record.supplier_ids || []}
                                    onChange={(vals) => {
                                        const newItems = [...items]
                                        newItems[index].supplier_ids = vals
                                        setItems(newItems)
                                    }}
                                    disabled={isReadOnly}
                                    maxTagCount="responsive"
                                    size="small"
                                    tagRender={(props) => {
                                        const sr = sortedSR.find(s => String(s.supplier_id) === props.value)
                                        const s = supplierMap[String(props.value)]
                                        return (
                                            <Tag
                                                color="processing"
                                                closable={!isReadOnly && props.closable}
                                                onClose={props.onClose}
                                                style={{ marginRight: 3 }}
                                            >
                                                {s?.supplier_name} ¥{sr?.settlement_price || '-'}
                                            </Tag>
                                        )
                                    }}
                                >
                                    {sortedSR.map(sr => {
                                        const s = supplierMap[String(sr.supplier_id)]
                                        const isLowest = sortedSR[0]?.supplier_id === sr.supplier_id
                                        return (
                                            <Select.Option key={sr.supplier_id} value={String(sr.supplier_id)}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span>{s?.supplier_name || sr.supplier_id}</span>
                                                    <Space size={4}>
                                                        <Tag color="gold" style={{ margin: 0 }}>¥{sr.settlement_price}</Tag>
                                                        {isLowest && <Tag color="success" style={{ margin: 0 }}>最低价</Tag>}
                                                    </Space>
                                                </div>
                                            </Select.Option>
                                        )
                                    })}
                                </Select>
                                {record.supplier_ids && record.supplier_ids.length > 0 && (
                                    <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                                        已选 {record.supplier_ids.length} 个供应商
                                    </div>
                                )}
                            </div>
                        )}
                    </Space>
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

    // Load template from existing product
    const handleLoadTemplate = async () => {
        if (!selectedTemplateId) {
            message.warning('请先选择一个产品作为模板')
            return
        }

        try {
            setLoading(true)
            // Fetch product details
            const p = await apiRequest<Product>(`/api/products/${selectedTemplateId}`)

            // Fill form
            form.setFieldsValue({
                product_name: `${p.product_name} (副本)`,
                product_code: p.product_code, // Copy product code
                description: p.description,
                status: 'draft', // Always draft for new products
                category_id: p.category_id,
                suggested_price: p.suggested_price,
                allowed_channels: p.allowed_channels,
            })
            setSuggestedPrice(p.suggested_price ? Number(p.suggested_price) : 0)

            // Fetch product resources
            const prRes = await apiRequest<{ items: any[] }>(`/api/product-resources?product_id=${selectedTemplateId}`)
            const links = prRes.items

            // Load resources
            const newItems = links.map((l, idx) => ({
                key: `${l.resource_id}_${idx}_${Date.now()}`,
                resource_id: String(l.resource_id),
                supplier_mode: l.supplier_mode || 'auto',
                supplier_ids: l.supplier_ids && l.supplier_ids.length > 0 ? l.supplier_ids.map(String) : (l.supplier_id ? [String(l.supplier_id)] : []),
                quantity: l.quantity,
                required_flag: l.required_flag,
                remark: l.remark,
            }))
            setItems(newItems)

            // Fetch resource data
            const rIds = Array.from(new Set(links.map((l: any) => String(l.resource_id))))
            await fetchResourcesData(rIds)

            setTemplateModalVisible(false)
            message.success(`已从 "${p.product_name}" 复制配置`)
        } catch (err: any) {
            message.error(err.message || '加载模板失败')
        } finally {
            setLoading(false)
        }
    }

    if (initLoading) {
        return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" tip="加载产品数据..." /></div>
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{productId ? '编辑产品' : '新建产品'}</h1>
                <p className="page-subtitle">组合资源构建产品，自动计算成本</p>
            </div>

            {/* Header Alert - Visual distinction */}
            {productId ? (
                <Alert
                    message={`正在编辑产品：${productMetadata?.product_name || '加载中...'}`}
                    description={productMetadata && (
                        <Space size={16}>
                            <span>产品ID: {productMetadata.id}</span>
                            {productMetadata.updated_at && (
                                <span>最后修改: {new Date(productMetadata.updated_at).toLocaleString('zh-CN')}</span>
                            )}
                        </Space>
                    )}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            ) : (
                <Alert
                    message="正在创建新产品"
                    description="您可以从现有产品复制配置，或从头开始创建"
                    type="info"
                    showIcon
                    action={
                        <Button size="small" type="link" onClick={() => setTemplateModalVisible(true)}>
                            从现有产品复制
                        </Button>
                    }
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* Product Info Card - Edit mode only */}
            {productId && productMetadata && (
                <Card
                    size="small"
                    title="产品信息"
                    style={{ marginBottom: 16 }}
                >
                    <Row gutter={16}>
                        <Col span={6}>
                            <Statistic title="产品ID" value={productMetadata.id} />
                        </Col>
                        <Col span={9}>
                            <Statistic
                                title="创建时间"
                                value={productMetadata.created_at ? new Date(productMetadata.created_at).toLocaleString('zh-CN') : '-'}
                            />
                        </Col>
                        <Col span={9}>
                            <Statistic
                                title="最后修改时间"
                                value={productMetadata.updated_at ? new Date(productMetadata.updated_at).toLocaleString('zh-CN') : '-'}
                            />
                        </Col>
                    </Row>
                </Card>
            )}

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
                                    <Form.Item label={renderLabel("产品名称", "product_name")} name="product_name" rules={[{ required: true }]}>
                                        <Input placeholder="输入产品名称" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label={renderLabel("产品编码", "product_code")} name="product_code">
                                        <Input placeholder="输入产品编码(可选)" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item label={renderLabel("产品分类", "category_id")} name="category_id">
                                        <Select
                                            placeholder="选择分类"
                                            allowClear
                                            options={categories.map(c => ({ value: c.id, label: c.name }))}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.Item label={renderLabel("产品描述", "description")} name="description">
                                <Input.TextArea rows={2} placeholder="输入描述" />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item label={renderLabel("建议零售价", "suggested_price")} name="suggested_price">
                                        <InputNumber style={{ width: '100%' }} prefix="¥" min={0} />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label={renderLabel("状态", "status")} name="status" initialValue="draft">
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

            {/* Template Selector Modal */}
            <Modal
                title="从现有产品复制配置"
                open={templateModalVisible}
                onCancel={() => setTemplateModalVisible(false)}
                onOk={handleLoadTemplate}
                confirmLoading={loading}
                okText="加载配置"
                width={600}
            >
                <p>选择一个现有产品作为模板，系统将复制其资源配置、供应商选择等信息：</p>
                <Select
                    style={{ width: '100%' }}
                    placeholder="请选择产品"
                    value={selectedTemplateId}
                    onChange={setSelectedTemplateId}
                    showSearch
                    filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={(data?.products || []).map(p => ({
                        value: p.id,
                        label: `${p.product_name} (ID: ${p.id})`
                    }))}
                />
            </Modal>
        </div>
    )
}
