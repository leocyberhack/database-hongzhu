import { useState, useRef, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Space, Card, Form, Select, Typography, Modal, Row, Col, Input } from 'antd'
import { CalendarOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import SKUCalendarEditor from '@/components/SKUCalendarEditor'
import type { SKUCalendarEditorRef } from '@/components/SKUCalendarEditor'
import PriceHistoryDrawer from '@/components/PriceHistoryDrawer'

const { Text } = Typography

interface PricingSummaryItem {
    sku_id: number
    spu_id?: number
    spu_name?: string
    channel_id: number
    sku_name: string
    channel_name: string
    min_price: number | null
    max_price: number | null
    status: 'active' | 'expired' | 'empty'
}

export default function PricingPage() {
    const { data, loadData } = useData()
    const channels = data.channels ?? []
    const skus = data.skus ?? []
    const products = data.products ?? []
    const spus = data.spus ?? []

    const [loading, setLoading] = useState(false)
    const [stockLimitMap, setStockLimitMap] = useState<Record<string, number>>({})
    const [items, setItems] = useState<PricingSummaryItem[]>([])
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

    const [filterSku, setFilterSku] = useState<number | null>(null)
    const [filterChannel, setFilterChannel] = useState<number | null>(null)
    const [filterStatus, setFilterStatus] = useState<string | null>(null)

    const [calendarVisible, setCalendarVisible] = useState(false)
    const [historyVisible, setHistoryVisible] = useState(false)
    const [currentRecord, setCurrentRecord] = useState<PricingSummaryItem | null>(null)

    const calendarRef = useRef<SKUCalendarEditorRef>(null)

    useEffect(() => {
        loadData(['channels', 'skus', 'products', 'spus'])
    }, [loadData])

    const fetchSummary = useCallback(async () => {
        setLoading(true)
        try {
            const qs = new URLSearchParams({
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
            })
            if (filterSku) qs.append('sku_id', String(filterSku))
            if (filterChannel) qs.append('channel_id', String(filterChannel))
            if (filterStatus) qs.append('status', filterStatus)

            const res = await apiRequest<{ items: PricingSummaryItem[]; pagination: { total: number } }>(
                `/api/pricing/summary?${qs.toString()}`
            )
            const list = res.items || []
            const enriched = list.map(item => {
                if (item.spu_name) return item
                const sku = skus.find(s => String(s.id) === String(item.sku_id))
                const spu = sku ? spus.find(s => String(s.id) === String(sku.spu_id)) : null
                return {
                    ...item,
                    spu_id: spu?.id,
                    spu_name: spu?.name || '-',
                }
            })
            enriched.sort((a, b) => {
                const na = a.spu_name || ''
                const nb = b.spu_name || ''
                return na.localeCompare(nb)
            })

            setItems(enriched)
            setPagination((prev) => ({ ...prev, total: res.pagination?.total || 0 }))
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [filterChannel, filterSku, filterStatus, pagination.current, pagination.pageSize, skus, spus])

    useEffect(() => {
        fetchSummary()
    }, [fetchSummary])

    const fetchStockLimits = async (skuId: number, channelId: number) => {
        try {
            const sku = skus.find(s => Number(s.id) === Number(skuId))
            if (!sku) {
                setStockLimitMap({})
                return
            }
            const product = products.find(p => String(p.id) === String(sku.product_id))
            if (!product) {
                setStockLimitMap({})
                return
            }

            let ratio = 100
            const allowed = (product as any).allowed_channels || []
            if (Array.isArray(allowed) && allowed.length > 0) {
                const alloc = allowed.find((a: any) => {
                    if (typeof a === 'object' && a !== null) {
                        return String(a.channel_id) === String(channelId)
                    }
                    return String(a) === String(channelId)
                })
                if (alloc && typeof alloc === 'object' && alloc.stock_ratio !== undefined && alloc.stock_ratio !== null) {
                    ratio = Number(alloc.stock_ratio)
                } else if (!alloc) {
                    ratio = 0
                }
            }

            const res = await apiRequest<{ items: { date: string, available_qty: number }[] }>(
                `/api/products/${product.id}/inventory`
            )
            const limit: Record<string, number> = {}
            res.items.forEach(item => {
                const cap = Math.floor(item.available_qty * (ratio / 100))
                limit[item.date] = cap
            })
            setStockLimitMap(limit)
        } catch (err) {
            console.error('fetch stock limits failed', err)
            setStockLimitMap({})
        }
    }

    const handleOpenCalendar = async (record: PricingSummaryItem) => {
        setCurrentRecord(record)
        await fetchStockLimits(record.sku_id, record.channel_id)
        setCalendarVisible(true)
    }

    const handleOpenHistory = (record: PricingSummaryItem) => {
        setCurrentRecord(record)
        setHistoryVisible(true)
    }

    const columns: any = [
        {
            title: '所属SPU',
            dataIndex: 'spu_name',
            key: 'spu_name',
            render: (text: string) => <Tag color="geekblue">{text || '-'}</Tag>,
        },
        {
            title: 'SKU 名称',
            dataIndex: 'sku_name',
            key: 'sku_name',
            render: (text: string) => <b>{text}</b>,
            sorter: true,
        },
        {
            title: '销售渠道',
            dataIndex: 'channel_name',
            key: 'channel_name',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: '当前价格区间',
            key: 'price',
            render: (_: any, r: PricingSummaryItem) => {
                if (r.min_price === null || r.max_price === null) {
                    return <Text type="secondary">暂无有效价格</Text>
                }
                if (r.min_price === r.max_price) {
                    return <Text strong style={{ fontSize: 16 }}>¥{r.min_price}</Text>
                }
                return (
                    <Space>
                        <Text strong style={{ fontSize: 16 }}>¥{r.min_price}</Text>
                        <Text type="secondary">~</Text>
                        <Text strong style={{ fontSize: 16 }}>¥{r.max_price}</Text>
                    </Space>
                )
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : 'default'}>
                    {status === 'active' ? '生效中' : '未上架'}
                </Tag>
            ),
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: PricingSummaryItem) => (
                <Space>
                    <Button
                        type="primary"
                        size="small"
                        icon={<CalendarOutlined />}
                        onClick={() => handleOpenCalendar(record)}
                    >
                        日历查看
                    </Button>
                    <Button
                        size="small"
                        icon={<HistoryOutlined />}
                        onClick={() => handleOpenHistory(record)}
                    >
                        历史
                    </Button>
                </Space>
            )
        }
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">定价中心 (M5)</h1>
                <p className="page-subtitle">SKU 价格策略与日历管理</p>
            </div>

            <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
                <Row gutter={16}>
                    <Col span={6}>
                        <Form.Item label="SKU" style={{ marginBottom: 0 }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="选择 SKU"
                                optionFilterProp="label"
                                options={skus.map(s => ({ value: Number(s.id), label: s.sku_name }))}
                                onChange={(v) => {
                                    setFilterSku(v || null)
                                    setPagination(prev => ({ ...prev, current: 1 }))
                                }}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item label="渠道" style={{ marginBottom: 0 }}>
                            <Select
                                showSearch
                                allowClear
                                placeholder="选择渠道"
                                optionFilterProp="label"
                                options={channels.map(c => ({ value: Number(c.id), label: c.channel_name }))}
                                onChange={(v) => {
                                    setFilterChannel(v || null)
                                    setPagination(prev => ({ ...prev, current: 1 }))
                                }}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item label="状态" style={{ marginBottom: 0 }}>
                            <Select
                                allowClear
                                placeholder="全部状态"
                                options={[
                                    { value: 'active', label: '生效中' },
                                    { value: 'empty', label: '未上架' },
                                ]}
                                value={filterStatus}
                                onChange={(v) => {
                                    setFilterStatus(v || null)
                                    setPagination(prev => ({ ...prev, current: 1 }))
                                }}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12} style={{ textAlign: 'right' }}>
                        <Button icon={<SearchOutlined />} onClick={() => fetchSummary()}>刷新数据</Button>
                    </Col>
                </Row>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table
                    rowKey={(r) => `${r.sku_id}_${r.channel_id}`}
                    columns={columns}
                    dataSource={items}
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
                title={`价格日历查看(只读) - ${currentRecord?.sku_name} @ ${currentRecord?.channel_name}`}
                open={calendarVisible}
                onCancel={() => setCalendarVisible(false)}
                width={1000}
                footer={[
                    <Button key="close" onClick={() => setCalendarVisible(false)}>
                        关闭
                    </Button>
                ]}
                destroyOnClose
            >
                {currentRecord && (
                    <SKUCalendarEditor
                        ref={calendarRef}
                        skuId={currentRecord.sku_id}
                        channelId={currentRecord.channel_id}
                        readOnly={true}
                        stockLimitData={stockLimitMap}
                    />
                )}
            </Modal>

            <PriceHistoryDrawer
                open={historyVisible}
                onClose={() => setHistoryVisible(false)}
                skuId={currentRecord?.sku_id}
                channelId={currentRecord?.channel_id}
                skuName={currentRecord?.sku_name}
                channelName={currentRecord?.channel_name}
            />
        </div>
    )
}
