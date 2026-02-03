import { Table, Button, Space } from 'antd'
import { useEffect } from 'react'
import { useData } from '@/contexts/DataContext'

export default function SupplierBindingsPage() {
    const { data, loadData } = useData()
    useEffect(() => {
        loadData(['supplier_resources', 'suppliers', 'resources'])
    }, [loadData])
    const supplierResources = data.supplier_resources ?? []
    const suppliers = data.suppliers ?? []
    const resources = data.resources ?? []

    const columns = [
        {
            title: '供应商',
            dataIndex: 'supplier_id',
            render: (v: string) => suppliers.find((s) => s.id === v)?.supplier_name || '-',
        },
        {
            title: '子资源',
            dataIndex: 'resource_id',
            render: (v: string) => resources.find((r) => r.id === v)?.resource_name || '-',
        },
        { title: '结算价', dataIndex: 'cost_price', render: (v: number) => `¥${v || 0}` },
        { title: '状态', dataIndex: 'status' },
        {
            title: '操作',
            render: () => (
                <Space>
                    <Button type="link" size="small">调价</Button>
                    <Button type="link" size="small">查看历史</Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">供应关系管理</h1>
                <p className="page-subtitle">供应商与子资源绑定关系</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table rowKey="id" columns={columns} dataSource={supplierResources} pagination={{ pageSize: 10 }} />
            </div>
        </div>
    )
}
