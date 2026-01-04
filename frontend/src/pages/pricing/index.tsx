import { Table, Tag, Button, Space } from 'antd'
import { useData } from '@/contexts/DataContext'
import type { Price } from '@/types'

export default function PricingPage() {
    const { data } = useData()
    const prices = data?.prices ?? []
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
        { title: '售价', dataIndex: 'sale_price', render: (v: number) => `¥${v}` },
        { title: '开始时间', dataIndex: 'start_at' },
        { title: '结束时间', dataIndex: 'end_at' },
        { title: '版本', dataIndex: 'version' },
        { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : v === 'pending' ? 'orange' : 'gray'}>{v}</Tag> },
        {
            title: '操作',
            render: () => (
                <Space>
                    <Button type="link" size="small">
                        调价
                    </Button>
                    <Button type="link" size="small">
                        历史
                    </Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">定价中心 (M5)</h1>
                <p className="page-subtitle">SKU 价格管理与历史</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Price> rowKey="id" columns={columns} dataSource={prices} pagination={{ pageSize: 10 }} />
            </div>
        </div>
    )
}
