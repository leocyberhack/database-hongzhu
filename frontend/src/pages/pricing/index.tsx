import { useState, useRef, useEffect } from 'react'
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
    channel_id: number
    sku_name: string
    channel_name: string
    min_price: number | null
    max_price: number | null
    status: 'active' | 'expired' | 'empty'
}

export default function PricingPage() {
    const { data } = useData()
    const channels = data?.channels ?? []
    const skus = data?.skus ?? []

    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<PricingSummaryItem[]>([])

    // Filters
    const [filterSku, setFilterSku] = useState<number | null>(null)
    const [filterChannel, setFilterChannel] = useState<number | null>(null)

    // Modal / Drawer State
    const [calendarVisible, setCalendarVisible] = useState(false)
    const [historyVisible, setHistoryVisible] = useState(false)
    const [currentRecord, setCurrentRecord] = useState<PricingSummaryItem | null>(null)

    const calendarRef = useRef<SKUCalendarEditorRef>(null)

    const fetchSummary = async () => {
        setLoading(true)
        try {
            const qs = new URLSearchParams()
            if (filterSku) qs.append('sku_id', String(filterSku))
            if (filterChannel) qs.append('channel_id', String(filterChannel))

            const res = await apiRequest<{ items: PricingSummaryItem[] }>(`/api/pricing/summary?${qs.toString()}`)
            setItems(res.items)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSummary()
    }, [filterSku, filterChannel])

    const handleOpenCalendar = (record: PricingSummaryItem) => {
        setCurrentRecord(record)
        setCalendarVisible(true)
    }

    const handleOpenHistory = (record: PricingSummaryItem) => {
        setCurrentRecord(record)
        setHistoryVisible(true)
    }

    const handleSaveCalendar = async () => {
        if (calendarRef.current && currentRecord) {
            await calendarRef.current.saveToBackend(currentRecord.sku_id, currentRecord.channel_id)
            setCalendarVisible(false)
            fetchSummary()
        }
    }

    const columns: any = [
        {
            title: 'SKU 名称',
            dataIndex: 'sku_name',
            key: 'sku_name',
            render: (text: string) => <b>{text}</b>,
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="搜索姓名"
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
            onFilter: (value: string, record: PricingSummaryItem) =>
                record.sku_name.toLowerCase().includes(value.toLowerCase()),
            sorter: (a: PricingSummaryItem, b: PricingSummaryItem) => a.sku_name.localeCompare(b.sku_name),
        },
        {
            title: '销售渠道',
            dataIndex: 'channel_name',
            key: 'channel_name',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
            filters: channels.map(c => ({ text: c.channel_name, value: c.channel_name })),
            onFilter: (value: string, record: PricingSummaryItem) => record.channel_name === value,
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
            filters: [
                { text: '生效中', value: 'active' },
                { text: '未上架', value: 'empty' },
            ],
            onFilter: (value: string, record: PricingSummaryItem) => record.status === value,
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
                        日历管理
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

            {/* Filters */}
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
                                onChange={setFilterSku}
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
                                onChange={setFilterChannel}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12} style={{ textAlign: 'right' }}>
                        <Button icon={<SearchOutlined />} onClick={fetchSummary}>刷新数据</Button>
                    </Col>
                </Row>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table
                    rowKey={(r) => `${r.sku_id}_${r.channel_id}`}
                    columns={columns}
                    dataSource={items}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    onChange={(pagination, filters, sorter) => {
                        console.log('Table Params:', pagination, filters, sorter);
                    }}
                />
            </div>

            {/* Calendar Modal */}
            <Modal
                title={`价格日历管理 - ${currentRecord?.sku_name} @ ${currentRecord?.channel_name}`}
                open={calendarVisible}
                onCancel={() => setCalendarVisible(false)}
                width={1000}
                onOk={handleSaveCalendar}
                okText="保存全部更改"
                cancelText="取消"
                destroyOnClose
            >
                {currentRecord && (
                    <SKUCalendarEditor
                        ref={calendarRef}
                        skuId={currentRecord.sku_id}
                        channelId={currentRecord.channel_id}
                        readonlyStock={true}
                    />
                )}
            </Modal>

            {/* History Drawer */}
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
