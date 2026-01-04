import { Table, Input, DatePicker, Space, Button } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import type { AuditLog } from '@/types'

export default function AuditLogPage() {
    const { data } = useData()
    const auditLog = data?.audit_log ?? []

    const columns = [
        { title: '对象类型', dataIndex: 'object_type' },
        { title: '对象ID', dataIndex: 'object_id' },
        { title: '操作', dataIndex: 'action' },
        { title: '操作人', dataIndex: 'actor' },
        { title: '时间', dataIndex: 'created_at' },
        {
            title: '详情',
            render: () => <Button type="link" size="small">查看</Button>,
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">审计日志 (M8)</h1>
                <p className="page-subtitle">系统操作记录查询</p>
            </div>

            <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
                <Space size="middle">
                    <Input placeholder="搜索对象ID" prefix={<SearchOutlined />} style={{ width: 200 }} />
                    <DatePicker.RangePicker />
                    <Button type="primary">查询</Button>
                </Space>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<AuditLog> rowKey="id" columns={columns} dataSource={auditLog} pagination={{ pageSize: 10 }} />
            </div>
        </div>
    )
}
