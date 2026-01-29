import { useEffect, useState, useCallback } from 'react'
import { Table, Progress, Card, DatePicker, Row, Col, Space, Button, Input, Select, Tag } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'

interface InventoryDay {
    id: string
    sku_id: string
    sku_name?: string
    channel_id?: string
    spu_id?: number
    spu_name?: string
    inventory_date: string
    total_qty: number
    frozen_qty: number
    sold_qty?: number
    available_qty?: number
    status?: string
}

export default function InventoryPage() {
    const { data, loadData } = useData()
    const channels = data.channels ?? []

    const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
    const [rows, setRows] = useState<InventoryDay[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

    const [filters, setFilters] = useState({
        keyword: '',
        channel_id: null as string | null,
    })

    useEffect(() => {
        loadData(['channels'])
    }, [loadData])

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                date: selectedDate.format('YYYY-MM-DD'),
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
            })
            if (filters.keyword.trim()) params.append('keyword', filters.keyword.trim())
            if (filters.channel_id) params.append('channel_id', String(filters.channel_id))
            const res = await apiRequest<{ items: InventoryDay[]; pagination: { total: number } }>(
                `/api/inventory/day?${params.toString()}`
            )
            setRows(res.items || [])
            setPagination((prev) => ({ ...prev, total: res.pagination?.total || 0 }))
        } catch (err) {
            console.error(err)
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [filters.channel_id, filters.keyword, pagination.current, pagination.pageSize, selectedDate])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const columns: any = [
        {
            title: '所属SPU',
            dataIndex: 'spu_name',
            render: (text: string) => <Tag color="geekblue">{text || '-'}</Tag>,
        },
        {
            title: 'SKU名称',
            dataIndex: 'sku_name',
            render: (v: string) => v || '-',
        },
        {
            title: '渠道',
            dataIndex: 'channel_id',
            render: (v: string) => channels.find((c) => String(c.id) === String(v))?.channel_name || '-',
        },
        {
            title: '库存总量',
            dataIndex: 'total_qty',
            sorter: true,
        },
        {
            title: '已冻结',
            dataIndex: 'frozen_qty',
            sorter: true,
        },
        {
            title: '已核销',
            dataIndex: 'sold_qty',
            sorter: true,
        },
        {
            title: '剩余可用',
            dataIndex: 'available_qty',
            render: (v: number | undefined, record: InventoryDay) => {
                const val = v !== undefined ? v : Math.max(0, (record.total_qty || 0) - (record.frozen_qty || 0) - (record.sold_qty || 0))
                return <span style={{ fontWeight: 'bold', color: val > 0 ? '#52c41a' : '#ff4d4f' }}>{val}</span>
            },
            sorter: true,
        },
        {
            title: '使用率',
            render: (_: any, record: InventoryDay) => {
                const available = record.available_qty !== undefined
                    ? record.available_qty
                    : Math.max(0, (record.total_qty || 0) - (record.frozen_qty || 0) - (record.sold_qty || 0))
                const used = (record.total_qty || 0) - available
                const pct = record.total_qty > 0 ? (used / record.total_qty) * 100 : 0
                return <Progress percent={Math.round(pct)} size="small" status={pct >= 100 ? 'exception' : 'normal'} />
            },
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">库存数据 (M6)</h1>
                <p className="page-subtitle">按日查看 SKU 库存</p>
            </div>

            <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 16 } }}>
                <Row gutter={16} align="middle">
                    <Col span={6}>
                        <Space direction="vertical" style={{ width: '100%' }} size={2}>
                            <span style={{ fontSize: 12, color: '#999' }}>日期</span>
                            <Space>
                                <DatePicker
                                    value={selectedDate}
                                    onChange={(v) => v && setSelectedDate(v)}
                                    allowClear={false}
                                    format="YYYY-MM-DD"
                                    style={{ width: 140 }}
                                />
                                <Button onClick={() => setSelectedDate(dayjs())}>今天</Button>
                            </Space>
                        </Space>
                    </Col>
                    <Col span={6}>
                        <Space direction="vertical" style={{ width: '100%' }} size={2}>
                            <span style={{ fontSize: 12, color: '#999' }}>关键词 (SKU)</span>
                            <Input
                                placeholder="搜索 SKU 名称"
                                value={filters.keyword}
                                onChange={e => {
                                    setFilters({ ...filters, keyword: e.target.value })
                                    setPagination(prev => ({ ...prev, current: 1 }))
                                }}
                                allowClear
                            />
                        </Space>
                    </Col>
                    <Col span={6}>
                        <Space direction="vertical" style={{ width: '100%' }} size={2}>
                            <span style={{ fontSize: 12, color: '#999' }}>渠道</span>
                            <Select
                                placeholder="全部渠道"
                                options={channels.map(c => ({ label: c.channel_name, value: c.id }))}
                                value={filters.channel_id}
                                onChange={v => {
                                    setFilters({ ...filters, channel_id: v || null })
                                    setPagination(prev => ({ ...prev, current: 1 }))
                                }}
                                allowClear
                                style={{ width: '100%' }}
                            />
                        </Space>
                    </Col>
                </Row>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<InventoryDay>
                    rowKey={(r) => `${r.sku_id}_${r.channel_id}_${r.inventory_date}`}
                    columns={columns}
                    dataSource={rows}
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
        </div>
    )
}
