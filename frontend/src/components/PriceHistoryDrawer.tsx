import { Drawer, Table, Tag, Timeline } from 'antd'
import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'


interface PriceHistoryDrawerProps {
    open: boolean
    onClose: () => void
    skuId?: number
    channelId?: number
    skuName?: string
    channelName?: string
}

export default function PriceHistoryDrawer({ open, onClose, skuId, channelId, skuName, channelName }: PriceHistoryDrawerProps) {
    const [prices, setPrices] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && skuId && channelId) {
            fetchHistory()
        }
    }, [open, skuId, channelId])

    const fetchHistory = async () => {
        setLoading(true)
        try {
            // Reusing existing prices endpoint but with all statuses
            const res = await apiRequest<any>(`/api/prices?sku_id=${skuId}&channel_id=${channelId}&page_size=100`)
            setPrices(res.items)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const columns = [
        {
            title: '售价',
            dataIndex: 'sale_price',
            key: 'sale_price',
            render: (v: number) => `¥${v}`
        },
        {
            title: '有效期',
            key: 'range',
            render: (_: any, r: any) => `${r.start_at} ~ ${r.end_at}`
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (v: string) => (
                <Tag color={v === 'active' ? 'green' : v === 'pending' ? 'orange' : 'default'}>
                    {v === 'active' ? '生效中' : v === 'pending' ? '待审核' : v === 'expired' ? '已失效' : v}
                </Tag>
            )
        },
        {
            title: '操作人',
            dataIndex: 'created_by',
            key: 'created_by',
        }
    ]

    // Timeline items for visual history
    const timelineItems = prices.map(p => ({
        color: p.status === 'active' ? 'green' : p.status === 'pending' ? 'blue' : 'gray',
        children: (
            <>
                <p><b>¥{p.sale_price}</b>
                    <Tag style={{ marginLeft: 8 }} color={p.status === 'active' ? 'green' : p.status === 'pending' ? 'orange' : 'default'}>
                        {p.status === 'active' ? '生效中' : p.status === 'pending' ? '待审核' : p.status === 'expired' ? '已失效' : p.status}
                    </Tag>
                </p>
                <p>{p.start_at} ~ {p.end_at}</p>
                <p style={{ fontSize: 12, color: '#999' }}>操作人: {p.created_by}</p>
            </>
        )
    }))

    return (
        <Drawer
            title={`价格历史 - ${skuName} (${channelName})`}
            width={600}
            open={open}
            onClose={onClose}
        >
            <Table
                rowKey="id"
                columns={columns}
                dataSource={prices}
                loading={loading}
                pagination={false}
                size="small"
                style={{ marginBottom: 24 }}
            />

            <div style={{ marginTop: 24 }}>
                <h4>变更时间轴</h4>
                <Timeline items={timelineItems} style={{ marginTop: 16 }} />
            </div>
        </Drawer>
    )
}
