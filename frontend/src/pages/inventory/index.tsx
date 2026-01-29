import { useEffect, useMemo, useState } from 'react'
import { Table, Progress, Card, DatePicker, Row, Col, Space, Button, Input, Select, Tag } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Inventory } from '@/types'

interface InventoryDay extends Inventory {
    sold_qty?: number
    available_qty?: number
    inventory_date: string
    channel_id?: string
    spu_id?: number
    spu_name?: string
}

export default function InventoryPage() {
    const { data } = useData()
    const skus = data?.skus ?? []
    const channels = data?.channels ?? []
    const spus = data?.spus ?? []
    const skuChannels = data?.sku_channels ?? []

    const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
    const [rows, setRows] = useState<InventoryDay[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

    // New Global Filters
    const [filters, setFilters] = useState({
        keyword: '',
        channel_id: null as string | null,
    })

    const channelMapBySku = useMemo(() => {
        const map: Record<string, string> = {}
        skuChannels.forEach((sc: any) => {
            if (!map[sc.sku_id]) {
                map[sc.sku_id] = String(sc.channel_id)
            }
        })
        return map
    }, [skuChannels])

    const fetchData = async (date: Dayjs) => {
        setLoading(true)
        try {
            const res = await apiRequest<{ items: InventoryDay[] }>(`/api/inventory/day?date=${date.format('YYYY-MM-DD')}&page_size=1000`)
            // 补充 channel_id 兜底（后端可能没绑定）
            const filled = (res.items || []).map((item) => {
                const sku = skus.find(s => String(s.id) === String(item.sku_id))
                // Enrich SPU info
                const spu = sku ? spus.find(s => String(s.id) === String(sku.spu_id)) : null
                return {
                    ...item,
                    channel_id: item.channel_id ?? channelMapBySku[String(item.sku_id)],
                    spu_id: spu?.id ? Number(spu.id) : undefined,
                    spu_name: spu?.name,
                }
            })
            // Default sort by SPU
            filled.sort((a, b) => {
                const na = a.spu_name || ''
                const nb = b.spu_name || ''
                return na.localeCompare(nb)
            })

            // Sorting is handled by backend default now, but we apply local filters on top
            setRows(filled)
            setPagination((prev) => ({ ...prev, current: 1 }))
        } catch (err) {
            console.error(err)
            setRows([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData(selectedDate)
    }, [selectedDate, channelMapBySku])

    // Filter Logic
    const filteredRows = useMemo(() => {
        return rows.filter(row => {
            // Global Keyword Filter (SKU Name)
            if (filters.keyword) {
                const skuName = skus.find(s => String(s.id) === String(row.sku_id))?.sku_name || ''
                if (!skuName.toLowerCase().includes(filters.keyword.toLowerCase())) return false
            }
            // Global Channel Filter
            if (filters.channel_id && String(row.channel_id) !== String(filters.channel_id)) {
                return false
            }
            return true
        })
    }, [rows, filters, skus])

    const columns: any = [
        {
            title: '所属 SPU',
            dataIndex: 'spu_name',
            render: (text: string) => <Tag color="geekblue">{text || '-'}</Tag>,
            sorter: (a: InventoryDay, b: InventoryDay) => (a.spu_name || '').localeCompare(b.spu_name || ''),
        },
        {
            title: 'SKU名称',
            dataIndex: 'sku_id',
            render: (v: string) => skus.find((s) => String(s.id) === String(v))?.sku_name || '-',
            // Single Column Filter: Search
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="搜索 SKU"
                        value={selectedKeys[0]}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{ width: 188, marginBottom: 8, display: 'block' }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() => confirm()}
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
            onFilter: (value: string, record: InventoryDay) => {
                const name = skus.find(s => String(s.id) === String(record.sku_id))?.sku_name || ''
                return name.toLowerCase().includes(value.toLowerCase())
            },
            sorter: (a: InventoryDay, b: InventoryDay) => {
                const nameA = skus.find(s => String(s.id) === String(a.sku_id))?.sku_name || ''
                const nameB = skus.find(s => String(s.id) === String(b.sku_id))?.sku_name || ''
                return nameA.localeCompare(nameB)
            },
        },
        {
            title: '渠道',
            dataIndex: 'channel_id',
            render: (v: string) => channels.find((c) => String(c.id) === String(v))?.channel_name || '-',
            // Single Column Filter: Select
            filters: channels.map(c => ({ text: c.channel_name, value: c.id })),
            onFilter: (value: string, record: InventoryDay) => String(record.channel_id) === String(value),
        },
        {
            title: '库存总量',
            dataIndex: 'total_qty',
            sorter: (a: InventoryDay, b: InventoryDay) => (a.total_qty || 0) - (b.total_qty || 0),
        },
        {
            title: '已冻结',
            dataIndex: 'frozen_qty',
            sorter: (a: InventoryDay, b: InventoryDay) => (a.frozen_qty || 0) - (b.frozen_qty || 0),
        },
        {
            title: '已核销',
            dataIndex: 'sold_qty',
            sorter: (a: InventoryDay, b: InventoryDay) => (a.sold_qty || 0) - (b.sold_qty || 0),
        },
        {
            title: '剩余可用',
            dataIndex: 'available_qty',
            render: (v: number | undefined, record: InventoryDay) => {
                const val = v !== undefined ? v : Math.max(0, (record.total_qty || 0) - (record.frozen_qty || 0) - (record.sold_qty || 0))
                return <span style={{ fontWeight: 'bold', color: val > 0 ? '#52c41a' : '#ff4d4f' }}>{val}</span>
            },
            sorter: (a: InventoryDay, b: InventoryDay) => {
                const valA = a.available_qty !== undefined ? a.available_qty : Math.max(0, (a.total_qty || 0) - (a.frozen_qty || 0) - (a.sold_qty || 0))
                const valB = b.available_qty !== undefined ? b.available_qty : Math.max(0, (b.total_qty || 0) - (b.frozen_qty || 0) - (b.sold_qty || 0))
                return valA - valB
            },
            // Single Column Filter: Range/Status
            filters: [
                { text: '有库存 (>0)', value: 'has_stock' },
                { text: '无库存 (0)', value: 'no_stock' },
            ],
            onFilter: (value: string, record: InventoryDay) => {
                const val = record.available_qty !== undefined ? record.available_qty : Math.max(0, (record.total_qty || 0) - (record.frozen_qty || 0) - (record.sold_qty || 0))
                if (value === 'has_stock') return val > 0
                if (value === 'no_stock') return val === 0
                return true
            }
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
            sorter: (a: InventoryDay, b: InventoryDay) => {
                const getPct = (r: InventoryDay) => {
                    const av = r.available_qty !== undefined ? r.available_qty : Math.max(0, (r.total_qty || 0) - (r.frozen_qty || 0) - (r.sold_qty || 0))
                    const u = (r.total_qty || 0) - av
                    return r.total_qty > 0 ? (u / r.total_qty) * 100 : 0
                }
                return getPct(a) - getPct(b)
            }
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
                                onChange={e => setFilters({ ...filters, keyword: e.target.value })}
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
                                onChange={v => setFilters({ ...filters, channel_id: v })}
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
                    dataSource={filteredRows}
                    loading={loading}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: filteredRows.length,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
                        onShowSizeChange: (current, size) => setPagination({ current, pageSize: size })
                    }}
                    onChange={(p) => setPagination({ current: p.current || 1, pageSize: p.pageSize || 10 })}
                />
            </div>
        </div>
    )
}
