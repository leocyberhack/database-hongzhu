import { Table } from 'antd'
import { useData } from '@/contexts/DataContext'
import type { PriceHistory } from '@/types'

export default function PriceHistoryPage() {
    const { data } = useData()
    const priceHistory = data?.price_history ?? []
    // const skus = data?.skus ?? []  // Not used currently

    const columns = [
        {
            title: 'SKU',
            dataIndex: 'price_id',
            render: () => '-',
        },
        { title: '原价格', dataIndex: 'old_price', render: (v: number) => `¥${v || 0}` },
        { title: '新价格', dataIndex: 'new_price', render: (v: number) => `¥${v}` },
        { title: '变更时间', dataIndex: 'changed_at' },
        { title: '变更原因', dataIndex: 'reason' },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">价格历史</h1>
                <p className="page-subtitle">所有价格调整记录</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<PriceHistory> rowKey="id" columns={columns} dataSource={priceHistory} pagination={{ pageSize: 10 }} />
            </div>
        </div>
    )
}
