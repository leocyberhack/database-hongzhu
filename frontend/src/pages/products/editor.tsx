import { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Form, Input, Button, Select, Card, Space, InputNumber, Switch, Table,
    Modal, Tag, Divider, Row, Col, Statistic, message, List, Popconfirm, Spin
} from 'antd'
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import type { Resource, Product, Supplier, SupplierResource } from '@/types'

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

    const [list, setList] = useState<Resource[]>([])
    const [loading, setLoading] = useState(false)
    const [filterKw, setFilterKw] = useState('')
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    // Debounce search or just search on enter/change
    useEffect(() => {
        if (!visible) return
        const fetchResources = async () => {
            setLoading(true)
            try {
                // Fetch page 1, size 50
                const qs = new URLSearchParams({
                    page: '1',
                    page_size: '50',
                })
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
    }, [visible, filterKw])

    const columns = [
        { title: '资源名称', dataIndex: 'resource_name' },
        { title: '类型', dataIndex: 'resource_type', render: (v: string) => <Tag>{v}</Tag> },
        {
            title: '所属POI',
            dataIndex: 'poi_id',
            render: (pid: string) => poiList.find(p => String(p.id) === String(pid))?.poi_name || '-'
        },
    ]

    return (
        <Modal
            title="选择要添加的资源"
            open={visible}
            onCancel={onCancel}
            width={800}
            onOk={() => {
                onSelect(selectedIds)
                setSelectedIds([])
            }}
            confirmLoading={loading}
        >
            <Space style={{ marginBottom: 16 }}>
                <Input
                    placeholder="搜索资源名称..."
                    prefix={<SearchOutlined />}
                    value={filterKw}
                    onChange={e => setFilterKw(e.target.value)}
                    allowClear
                />
            </Space>
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
                scroll={{ y: 400 }}
            />
        </Modal>
    )
}

// -- Category Manager Component --
function CategoryManager() {
    const { data, refresh } = useData()
    const categories = data?.product_categories ?? []
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)

    const handleAdd = async (values: any) => {
        setLoading(true)
        try {
            await apiRequest('/api/product-categories', { method: 'POST', body: JSON.stringify(values) })
            message.success('分类已添加')
            form.resetFields()
            await refresh()
        } catch (err: any) {
            message.error(err.message || '添加失败')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await apiRequest(`/api/product-categories/${id}`, { method: 'DELETE' })
            message.success('分类已删除')
            await refresh()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    return (
        <Card title="产品分类管理" size="small" style={{ marginTop: 24 }}>
            <List
                size="small"
                dataSource={categories}
                renderItem={(item) => (
                    <List.Item
                        actions={[
                            <Popconfirm title="确定删除?" onConfirm={() => handleDelete(item.id)} key="del">
                                <Button type="link" danger size="small">删除</Button>
                            </Popconfirm>
                        ]}
                    >
                        <List.Item.Meta
                            title={item.name}
                            description={item.description}
                        />
                        <Tag color={item.status === 'active' ? 'green' : 'red'}>{item.status}</Tag>
                    </List.Item>
                )}
            />
            <Divider>添加新分类</Divider>
            <Form layout="inline" form={form} onFinish={handleAdd}>
                <Form.Item name="name" rules={[{ required: true, message: '名称' }]}>
                    <Input placeholder="分类名称" />
                </Form.Item>
                <Form.Item name="description">
                    <Input placeholder="描述" />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} icon={<PlusOutlined />}>添加</Button>
                </Form.Item>
            </Form>
        </Card>
    )
}

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

    const [form] = Form.useForm()
    const [items, setItems] = useState<SelectedResourceItem[]>([])
    const [modalVisible, setModalVisible] = useState(false)
    const [loading, setLoading] = useState(false)
    const [initLoading, setInitLoading] = useState(false)

    // Local caches for this page (to support specific ID fetching)
    const [resourceMap, setResourceMap] = useState<Record<string, Resource>>({})
    const [supplierMap, setSupplierMap] = useState<Record<string, Supplier>>({})
    const [supplierResourceMap, setSupplierResourceMap] = useState<Record<string, SupplierResource[]>>({}) // resource_id -> list of SRs

    const categories = data?.product_categories ?? []

    // Helper to fetch data for specific resources (resource info -> supplier options -> supplier info)
    const fetchResourcesData = useCallback(async (resourceIds: string[]) => {
        if (resourceIds.length === 0) return

        // Filter out what we already have (optional optimization, but strict consistency is better)
        // For simplicity, we just fetch what is asked to ensure latest prices.

        try {
            // 1. Fetch Resources
            const rRes = await apiRequest<{ items: Resource[] }>(`/api/resources?ids=${resourceIds.join(',')}&page_size=1000`)
            const newResMap = { ...resourceMap }
            rRes.items.forEach(r => newResMap[r.id] = r)
            setResourceMap(prev => ({ ...prev, ...newResMap }))

            // 2. Fetch Helper: Available Suppliers for these resources
            // We use the new resource_ids filter
            const srRes = await apiRequest<{ items: SupplierResource[] }>(`/api/supplier-resources?resource_ids=${resourceIds.join(',')}&page_size=1000`)

            // Group SRs by resource_id
            const newSRMap = { ...supplierResourceMap }
            // Initialize empty arrays for requested IDs to ensure we clear old data if re-fetching? 
            // Better to append or replace. For now, let's group.
            const sIdsToFetch = new Set<string>()

            // Reset mapping for these resources
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
                const sRes = await apiRequest<{ items: Supplier[] }>(`/api/suppliers?ids=${Array.from(sIdsToFetch).join(',')}&page_size=1000`)
                const newSupMap = { ...supplierMap }
                sRes.items.forEach(s => newSupMap[s.id] = s)
                setSupplierMap(prev => ({ ...prev, ...newSupMap }))
            }

        } catch (err) {
            console.error('Fetch resources data error', err)
            message.error('加载资源详情失败')
        }
    }, []) // Dependencies intentionally empty or minimal

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
                })

                // 2. Fetch Product Resources
                const prRes = await apiRequest<{ items: any[] }>(`/api/product-resources?product_id=${productId}`)
                const links = prRes.items

                // 3. Prepare items state
                const newItems = links.map((l, idx) => ({
                    key: `${l.resource_id}_${idx}`,
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
            key: `${id}_${Date.now()}_${Math.random()}`,
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
            structure_hash: `HASH_${Date.now()}`, // Simple mock hash
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
                <InputNumber min={1} value={qty} onChange={v => {
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
                <Switch size="small" checked={flag} onChange={v => {
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
                }} />
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
                        <Form layout="vertical" form={form} onFinish={handleSave}>
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

                            <Divider>资源组合</Divider>

                            <Table
                                rowKey="key"
                                columns={itemColumns}
                                dataSource={items}
                                pagination={false}
                                footer={() => (
                                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                                        添加资源
                                    </Button>
                                )}
                            />

                            <div style={{ marginTop: 24, padding: 16, background: '#f6f6f6', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Statistic title="预估总成本" value={totalCost} precision={2} prefix="¥" valueStyle={{ color: '#cf1322' }} />
                                    <div style={{ fontSize: 12, color: '#999' }}>* 根据所选供应商结算价计算</div>
                                </div>
                                <Space>
                                    <Button size="large" onClick={() => navigate('/products/list')}>取消</Button>
                                    <Button type="primary" size="large" htmlType="submit" loading={loading}>
                                        {productId ? '保存修改' : '立即创建'}
                                    </Button>
                                </Space>
                            </div>
                        </Form>
                    </div>

                    <CategoryManager />
                </Col>

                <Col span={8}>
                    <Card title="帮助指南" size="small" className="glass-card" bordered={false}>
                        <p>1. <b>分类管理</b>：请先在底部建立好产品分类。</p>
                        <p>2. <b>资源选择</b>：从资源库中选择门票、酒店等。</p>
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
