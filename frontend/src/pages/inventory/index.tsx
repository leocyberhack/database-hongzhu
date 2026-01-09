import { useEffect, useMemo, useState } from 'react'
import { Table, Progress, Card, DatePicker, Row, Col, Space, Button } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Inventory } from '@/types'

interface InventoryDay extends Inventory {
    sold_qty?: number
    available_qty?: number
    inventory_date: string
    channel_id?: string
}

export default function InventoryPage() {
    const { data } = useData()
    const skus = data?.skus ?? []
    const channels = data?.channels ?? []
    const skuChannels = data?.sku_channels ?? []

    const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
    const [rows, setRows] = useState<InventoryDay[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

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
            const filled = (res.items || []).map((item) => ({
                ...item,
                channel_id: item.channel_id ?? channelMapBySku[String(item.sku_id)],
            }))
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

    const columns = [
        {
            title: 'SKU名称',
            dataIndex: 'sku_id',
            render: (v: string) => skus.find((s) => String(s.id) === String(v))?.sku_name || '-',
        },
        {
            title: '渠道',
            dataIndex: 'channel_id',
            render: (v: string) => channels.find((c) => String(c.id) === String(v))?.channel_name || '-',
        },
        { title: '库存总量', dataIndex: 'total_qty' },
        { title: '已冻结', dataIndex: 'frozen_qty' },
        { title: '已核销', dataIndex: 'sold_qty' },
        {
            title: '剩余可用',
            dataIndex: 'available_qty',
            render: (v: number | undefined, record: InventoryDay) => {
                if (v !== undefined) return v
                return Math.max(0, (record.total_qty || 0) - (record.frozen_qty || 0) - (record.sold_qty || 0))
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
                return <Progress percent={Math.round(pct)} size="small" />
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
                    <Col span={8}>
                        <Space>
                            <span>日期：</span>
                            <DatePicker
                                value={selectedDate}
                                onChange={(v) => v && setSelectedDate(v)}
                                allowClear={false}
                                format="YYYY-MM-DD"
                            />
                            <Button onClick={() => setSelectedDate(dayjs())}>今天</Button>
                        </Space>
                    </Col>
                    <Col span={16} style={{ textAlign: 'right' }}>
                        <span style={{ color: '#666' }}>当前日期：{selectedDate.format('YYYY-MM-DD')}</span>
                    </Col>
                </Row>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<InventoryDay>
                    rowKey="id"
                    columns={columns}
                    dataSource={rows.slice((pagination.current - 1) * pagination.pageSize, pagination.current * pagination.pageSize)}
                    loading={loading}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: rows.length,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                    }}
                    onChange={(p) => setPagination({ current: p.current || 1, pageSize: p.pageSize || 10 })}
                />
            </div>
        </div>
    )
}
