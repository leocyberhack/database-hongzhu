import { useState, useEffect } from 'react'
import { Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, InputNumber, Tooltip } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type { Channel } from '@/types'

export default function ChannelsPage() {
    const { data, loadData } = useData()
    useEffect(() => {
        loadData(['channels', 'skus', 'sku_channels', 'approvals'])
    }, [loadData])
    const channels = data.channels ?? []
    const skus = data.skus ?? []
    const skuChannels = data.sku_channels ?? []
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
    const [modalVisible, setModalVisible] = useState(false)
    const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
    const [form] = Form.useForm()
    const { user } = useAuth()

    const handleSaveChannel = async (values: any) => {
        try {
            if (editingChannel) {
                await apiRequest(`/api/channels/${editingChannel.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(values),
                })
                message.success('渠道更新成功')
            } else {
                await apiRequest('/api/channels', {
                    method: 'POST',
                    body: JSON.stringify(values),
                })
                message.success('渠道创建成功')
            }
            setModalVisible(false)
            setEditingChannel(null)
            form.resetFields()
            await loadData(['channels', 'skus', 'sku_channels', 'approvals'], { force: true })
        } catch (err: any) {
            message.error(err.message || (editingChannel ? '更新失败' : '创建失败'))
        }
    }

    const handleDelete = async (id: string | number) => {
        try {
            await apiRequest(`/api/channels/${id}`, {
                method: 'DELETE',
            })
            message.success('渠道删除成功')
            await loadData(['channels', 'skus', 'sku_channels', 'approvals'], { force: true })
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const openEdit = (record: Channel) => {
        setEditingChannel(record)
        form.setFieldsValue(record)
        setModalVisible(true)
    }

    const columns = [
        { title: '渠道名称', dataIndex: 'channel_name' },
        { title: '渠道类型', dataIndex: 'channel_type' },
        {
            title: '渠道费百分比',
            dataIndex: 'commission_rate',
            render: (v: number | null | undefined, record: Channel) => {
                // Debug logging - check browser console
                console.log('Commission rate for', record.channel_name, ':', v, typeof v);

                // Handle null/undefined
                if (v === undefined || v === null) {
                    return <span style={{ color: '#999' }}>-</span>;
                }

                // Convert to number and format as percentage
                const numValue = Number(v);
                if (isNaN(numValue)) {
                    return <span style={{ color: '#ff4d4f' }}>无效值</span>;
                }

                return `${(numValue * 100).toFixed(2)}%`;
            }
        },

        {
            title: '操作',
            render: (_: any, record: Channel) => {
                const isLocked = skus.some((s: any) => String(s.channel_id) === String(record.id)) ||
                    skuChannels.some(sc => String(sc.channel_id) === String(record.id))

                // Check if this channel has pending approval (update/delete)
                // Or if it IS a pending creation (id=0 or from approval)
                const isPendingCreation = record.status === 'pending_approval'
                const hasPendingUpdate = data?.approvals?.some(a =>
                    a.object_type === 'channel' &&
                    String(a.object_id) === String(record.id) &&
                    a.status === 'pending'
                )

                if (isPendingCreation || hasPendingUpdate) {
                    return (
                        <Button
                            type="primary"
                            size="small"
                            ghost
                            onClick={() => message.info('已通知管理员尽快审批')}
                        >
                            催一催
                        </Button>
                    )
                }

                // CSR can view but not operate
                if (user?.role === 'csr') {
                    return <span style={{ color: '#ccc' }}>无权限</span>
                }

                return (
                    <Space>
                        <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
                        {isLocked ? (
                            <Tooltip title="该渠道已有关联SKU(已创建)，不可删除">
                                <Button type="link" size="small" danger disabled>删除</Button>
                            </Tooltip>
                        ) : (
                            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
                                <Button type="link" size="small" danger>删除</Button>
                            </Popconfirm>
                        )}
                    </Space>
                )
            },
        },
    ]

    // Mix in pending creations from approvals
    const pendingChannels: Channel[] = (data.approvals || [])
        .filter(a => a.object_type === 'channel' && a.action_type === 'create' && a.status === 'pending')
        .map((a) => ({
            id: `pending_${a.id}`, // Virtual ID
            channel_name: a.after_data?.channel_name || '待审批渠道',
            channel_type: a.after_data?.channel_type || '-',
            commission_rate: a.after_data?.commission_rate,
            status: 'pending_approval',
            created_at: a.applied_at
        } as Channel))

    const displayChannels = [...pendingChannels, ...channels]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">渠道管理 (M4)</h1>
                    <p className="page-subtitle">销售渠道配置</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                    setEditingChannel(null)
                    form.resetFields()
                    setModalVisible(true)
                }}>
                    新建渠道
                </Button>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Channel>
                    rowKey="id"
                    columns={columns}
                    dataSource={displayChannels.slice((pagination.current - 1) * pagination.pageSize, pagination.current * pagination.pageSize)}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: displayChannels.length,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                    }}
                    onChange={(p) => setPagination({ current: p.current || 1, pageSize: p.pageSize || 10 })}
                />
            </div>

            <Modal
                title={editingChannel ? "编辑渠道" : "创建渠道"}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false)
                    setEditingChannel(null)
                    form.resetFields()
                }}
                footer={null}
                width={500}
            >
                <Form form={form} layout="vertical" onFinish={handleSaveChannel}>
                    <Form.Item name="channel_name" label="渠道名称" rules={[{ required: true, message: '请输入渠道名称' }]}>
                        <Input placeholder="例如：携程" />
                    </Form.Item>
                    <Form.Item name="channel_type" label="渠道类型" rules={[{ required: true, message: '请选择渠道类型' }]}>
                        <Select
                            placeholder="选择类型"
                            options={[
                                { value: 'OTA', label: 'OTA平台' },
                                { value: '直销', label: '直销' },
                                { value: '分销', label: '分销商' },
                                { value: '内容输出平台', label: '内容输出平台' },
                                { value: '其他', label: '其他' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item name="commission_rate" label="渠道费百分比 (0.05 = 5%)">
                        <InputNumber style={{ width: '100%' }} step="0.0001" placeholder="例如：0.05" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setModalVisible(false)
                                setEditingChannel(null)
                                form.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                {editingChannel ? "保存" : "创建"}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
