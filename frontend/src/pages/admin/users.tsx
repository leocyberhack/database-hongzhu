import { useState, useEffect } from 'react'
import { Form, Input, Button, Select, Table, message, Space, Modal, Tag } from 'antd'
import { PlusOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons'
import { useAuth } from '@/contexts/AuthContext'
import { apiRequest } from '@/lib/api'

interface UserRow {
    id: number
    username: string
    role: string
}

const ROLE_OPTIONS = [
    { label: '总管', value: 'admin' },
    { label: '产品经理', value: 'product' },
    { label: '运营', value: 'operator' },
    { label: '客服', value: 'csr' },
]

const ROLE_COLORS: Record<string, string> = {
    admin: '#ff4d4f',
    product: '#1890ff',
    operator: '#52c41a',
    csr: '#faad14',
}

export default function UserAdminPage() {
    const { user } = useAuth()
    const [users, setUsers] = useState<UserRow[]>([])
    const [loading, setLoading] = useState(false)
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [editModalVisible, setEditModalVisible] = useState(false)
    const [editingUser, setEditingUser] = useState<UserRow | null>(null)
    const [createForm] = Form.useForm()
    const [editForm] = Form.useForm()

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const res = await apiRequest<UserRow[]>('/api/auth/users')
            setUsers(res)
        } catch (err: any) {
            message.error(err?.message || '加载用户失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const onCreateUser = async (values: { username: string; password: string; role: string }) => {
        try {
            await apiRequest<UserRow>('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(values),
            })
            message.success('用户创建成功')
            setCreateModalVisible(false)
            createForm.resetFields()
            fetchUsers()
        } catch (err: any) {
            message.error(err?.message || '创建失败')
        }
    }

    const onEditRole = async (values: { role: string }) => {
        if (!editingUser) return
        try {
            await apiRequest(`/api/auth/users/${editingUser.id}/role`, {
                method: 'PUT',
                body: JSON.stringify(values),
            })
            message.success('角色更新成功')
            setEditModalVisible(false)
            setEditingUser(null)
            fetchUsers()
        } catch (err: any) {
            message.error(err?.message || '更新失败')
        }
    }

    const openEditModal = (record: UserRow) => {
        setEditingUser(record)
        editForm.setFieldsValue({ role: record.role })
        setEditModalVisible(true)
    }

    if (user?.role !== 'admin') {
        return (
            <div className="page-container">
                <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
                    <h2>权限不足</h2>
                    <p>仅管理员可以访问用户管理页面</p>
                </div>
            </div>
        )
    }

    const columns = [
        { title: 'ID', dataIndex: 'id', width: 80 },
        { title: '用户名', dataIndex: 'username' },
        {
            title: '角色',
            dataIndex: 'role',
            render: (role: string) => {
                const roleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.label || role
                return <Tag color={ROLE_COLORS[role] || 'default'}>{roleLabel}</Tag>
            },
        },
        {
            title: '操作',
            render: (_: any, record: UserRow) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEditModal(record)}
                    >
                        修改角色
                    </Button>
                    <Button type="link" size="small" icon={<KeyOutlined />} disabled>
                        重置密码
                    </Button>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">用户与权限管理</h1>
                    <p className="page-subtitle" style={{ color: '#1e293b' }}>创建用户账号、分配和修改角色权限</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                    创建用户
                </Button>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<UserRow>
                    loading={loading}
                    dataSource={users}
                    rowKey="id"
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                />
            </div>

            {/* 创建用户模态框 */}
            <Modal
                title="创建新用户"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false)
                    createForm.resetFields()
                }}
                footer={null}
                width={500}
            >
                <Form layout="vertical" form={createForm} onFinish={onCreateUser} initialValues={{ role: 'csr' }}>
                    <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                        <Input placeholder="请输入用户名" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label="密码"
                        rules={[
                            { required: true, message: '请输入密码' },
                            { min: 6, message: '密码至少6个字符' },
                        ]}
                    >
                        <Input.Password placeholder="请输入密码（至少6个字符）" />
                    </Form.Item>
                    <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
                        <Select options={ROLE_OPTIONS} placeholder="选择用户角色" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setCreateModalVisible(false)
                                createForm.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                创建用户
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 编辑角色模态框 */}
            <Modal
                title={`修改用户角色 - ${editingUser?.username}`}
                open={editModalVisible}
                onCancel={() => {
                    setEditModalVisible(false)
                    setEditingUser(null)
                }}
                footer={null}
                width={400}
            >
                <Form layout="vertical" form={editForm} onFinish={onEditRole}>
                    <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
                        <Select options={ROLE_OPTIONS} placeholder="选择新角色" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setEditModalVisible(false)
                                setEditingUser(null)
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                保存修改
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
