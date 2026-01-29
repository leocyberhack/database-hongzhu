import { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Button, Space, Modal, Input, message, Popconfirm } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type { Approval } from '@/types'

export default function ApprovalsPendingPage() {
    const { user } = useAuth()
    const [rows, setRows] = useState<Approval[]>([])
    const [loading, setLoading] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
    const [rejectId, setRejectId] = useState<number | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

    const isSuperAdmin = user?.role === 'super_admin'

    const fetchApprovals = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: String(pagination.current),
                page_size: String(pagination.pageSize),
            })
            if (!isSuperAdmin) params.append('status', 'pending')
            const res = await apiRequest<{ items: Approval[]; pagination: { total: number } }>(`/api/approvals?${params.toString()}`)
            setRows(res.items || [])
            setPagination(prev => ({ ...prev, total: res.pagination?.total || 0 }))
        } catch (err: any) {
            message.error(err.message || '加载审批失败')
            setRows([])
        } finally {
            setLoading(false)
        }
    }, [isSuperAdmin, pagination.current, pagination.pageSize])

    useEffect(() => {
        fetchApprovals()
    }, [fetchApprovals])

    const handleDecision = async (id: number, approve: boolean, comment?: string) => {
        setLoading(true)
        try {
            await apiRequest(`/api/approvals/${id}/decision`, {
                method: 'POST',
                body: JSON.stringify({ approve, comment }),
            })
            message.success(approve ? '已批准' : '已驳回')
            setRejectId(null)
            setRejectReason('')
            await fetchApprovals()
        } catch (err: any) {
            message.error(err.message || '操作失败')
        } finally {
            setLoading(false)
        }
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        setLoading(true)
        try {
            await apiRequest('/api/approvals/batch-delete', {
                method: 'POST',
                body: JSON.stringify({ ids: selectedRowKeys }),
            })
            message.success('批量删除成功')
            setSelectedRowKeys([])
            await fetchApprovals()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        } finally {
            setLoading(false)
        }
    }

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: '对象类型', dataIndex: 'object_type' },
        { title: '对象ID', dataIndex: 'object_id' },
        { title: '操作类型', dataIndex: 'action_type' },
        {
            title: '变更内容',
            dataIndex: 'after_data',
            render: (v: any) => v ? JSON.stringify(v).slice(0, 50) + '...' : '-'
        },
        { title: '提交人', dataIndex: 'applicant' },
        { title: '提交时间', dataIndex: 'applied_at' },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => (
                <Tag color={v === 'pending' ? 'orange' : v === 'approved' ? 'green' : 'red'}>{v}</Tag>
            ),
        },
        {
            title: '操作',
            render: (_: any, record: Approval) => {
                if (record.status !== 'pending') return <span style={{ color: '#ccc' }}>已处理</span>

                return (
                    <Space>
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => handleDecision(record.id, true)}
                            disabled={loading}
                        >
                            批准
                        </Button>
                        <Button
                            danger
                            size="small"
                            onClick={() => setRejectId(record.id)}
                            disabled={loading}
                        >
                            驳回
                        </Button>
                    </Space>
                )
            },
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <h1 className="page-title">审批中心 (M8)</h1>
                    <p className="page-subtitle">管理待审批请求及历史记录</p>
                </div>
                {isSuperAdmin && selectedRowKeys.length > 0 && (
                    <Popconfirm
                        title={`确定删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                        onConfirm={handleBatchDelete}
                        description="删除审批记录不会撤销已执行的操作，但会移除历史痕迹。"
                    >
                        <Button danger icon={<DeleteOutlined />} loading={loading}>
                            批量删除 ({selectedRowKeys.length})
                        </Button>
                    </Popconfirm>
                )}
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Approval>
                    rowKey="id"
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
                    rowSelection={isSuperAdmin ? {
                        selectedRowKeys,
                        onChange: setSelectedRowKeys
                    } : undefined}
                />
            </div>

            <Modal
                title="驳回审批"
                open={!!rejectId}
                onCancel={() => {
                    setRejectId(null)
                    setRejectReason('')
                }}
                onOk={() => {
                    if (!rejectReason.trim()) {
                        message.error('请输入驳回原因')
                        return
                    }
                    if (rejectId) handleDecision(rejectId, false, rejectReason)
                }}
                confirmLoading={loading}
            >
                <Input.TextArea
                    rows={4}
                    placeholder="请输入驳回原因（必填）"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                />
            </Modal>
        </div>
    )
}
