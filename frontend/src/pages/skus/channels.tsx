import { useState } from 'react'
import { Table, Tag, Button, Space, Modal, Form, Input, Select, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Channel } from '@/types'

export default function ChannelsPage() {
    const { data, refresh } = useData()
    const channels = data?.channels ?? []
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [form] = Form.useForm()

    const handleCreateChannel = async (values: any) => {
        try {
            await apiRequest('/api/channels', {
                method: 'POST',
                body: JSON.stringify(values),
            })
            message.success('渠道创建成功')
            setCreateModalVisible(false)
            form.resetFields()
            await refresh()
        } catch (err: any) {
            message.error(err.message || '创建失败')
        }
    }

    const columns = [
        { title: '渠道名称', dataIndex: 'channel_name' },
        { title: '渠道类型', dataIndex: 'channel_type' },
        { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : 'gray'}>{v}</Tag> },
        {
            title: '操作',
            render: () => (
                <Space>
                    <Button type="link" size="small">查看</Button>
                    <Button type="link" size="small">编辑</Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">渠道管理 (M4)</h1>
                    <p className="page-subtitle">销售渠道配置</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                    新建渠道
                </Button>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Channel> rowKey="id" columns={columns} dataSource={channels} pagination={{ pageSize: 10 }} />
            </div>

            <Modal
                title="创建渠道"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false)
                    form.resetFields()
                }}
                footer={null}
                width={500}
            >
                <Form form={form} layout="vertical" onFinish={handleCreateChannel}>
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
                    <Form.Item name="status" label="状态" initialValue="active">
                        <Select
                            options={[
                                { value: 'active', label: '启用' },
                                { value: 'inactive', label: '停用' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setCreateModalVisible(false)
                                form.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                创建
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
