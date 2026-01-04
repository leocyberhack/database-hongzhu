import { Table, Tag, Button, Space } from 'antd'
import { useData } from '@/contexts/DataContext'
import type { Approval } from '@/types'

export default function ApprovalsPendingPage() {
    const { data } = useData()
    const approvals = data?.approvals ?? []
    const pendingApprovals = approvals.filter((a) => a.status === 'pending')

    const columns = [
        { title: '对象类型', dataIndex: 'object_type' },
        { title: '对象ID', dataIndex: 'object_id' },
        { title: '操作类型', dataIndex: 'action_type' },
        { title: '提交人', dataIndex: 'submitted_by' },
        { title: '提交时间', dataIndex: 'created_at' },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => (
                <Tag color={v === 'pending' ? 'orange' : v === 'approved' ? 'green' : 'red'}>{v}</Tag>
            ),
        },
        {
            title: '操作',
            render: () => (
                <Space>
                    <Button type="primary" size="small">批准</Button>
                    <Button danger size="small">驳回</Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">待审批列表 (M8)</h1>
                <p className="page-subtitle">待处理的审批请求</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Approval> rowKey="id" columns={columns} dataSource={pendingApprovals} pagination={{ pageSize: 10 }} />
            </div>
        </div>
    )
}
