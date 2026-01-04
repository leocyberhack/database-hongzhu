import { Table, Progress } from 'antd'
import { useData } from '@/contexts/DataContext'
import type { Inventory } from '@/types'

export default function InventoryPage() {
    const { data } = useData()
    const inventory = data?.inventory ?? []
    const skus = data?.skus ?? []
    const channels = data?.channels ?? []

    const columns = [
        {
            title: 'SKU',
            dataIndex: 'sku_id',
            render: (v: string) => skus.find((s) => s.id === v)?.sku_name || '-',
        },
        {
            title: '渠道',
            dataIndex: 'channel_id',
            render: (v: string) => channels.find((c) => c.id === v)?.name || '-',
        },
        { title: '日期', dataIndex: 'date' },
        { title: '总量', dataIndex: 'total_qty' },
        { title: '已冻结', dataIndex: 'frozen_qty' },
        { title: '可用', dataIndex: 'available_qty' },
        {
            title: '使用率',
            render: (_: any, record: Inventory) => {
                const pct = record.total_qty > 0 ? ((record.total_qty - record.available_qty) / record.total_qty) * 100 : 0
                return <Progress percent={Math.round(pct)} size="small" />
            },
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">库存管理 (M6)</h1>
                <p className="page-subtitle">库存日历与调整</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Inventory> rowKey="id" columns={columns} dataSource={inventory} pagination={{ pageSize: 10 }} />
            </div>
        </div>
    )
}
