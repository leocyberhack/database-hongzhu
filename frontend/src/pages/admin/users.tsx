import { useState, useEffect, useMemo } from 'react'
import { Form, Input, Button, Select, Table, message, Space, Modal, Tag, Popconfirm, Row, Col } from 'antd'
import { PlusOutlined, EditOutlined, KeyOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { useAuth } from '@/contexts/AuthContext'
import { apiRequest } from '@/lib/api'

interface UserRow {
    id: number
    username: string
    role: string
}

const ROLE_OPTIONS = [
    { label: '超级管理员', value: 'super_admin' },
    { label: '管理员', value: 'admin' },
    { label: '产品经理', value: 'product' },
    { label: '运营', value: 'operator' },
    { label: '客服', value: 'csr' },
]

const ROLE_COLORS: Record<string, string> = {
    super_admin: '#722ed1',
    admin: '#ff4d4f',
    product: '#1890ff',
    operator: '#52c41a',
    csr: '#faad14',
}

export default function UserAdminPage() {
    const { user } = useAuth()
    const [users, setUsers] = useState<UserRow[]>([])
    const [loading, setLoading] = useState(false)

    // Modal States
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [editModalVisible, setEditModalVisible] = useState(false)
    const [editingUser, setEditingUser] = useState<UserRow | null>(null)
    const [resetPasswordVisible, setResetPasswordVisible] = useState(false)
    const [resetPasswordUser, setResetPasswordUser] = useState<UserRow | null>(null)

    // Forms
    const [createForm] = Form.useForm()
    const [editForm] = Form.useForm()
    const [resetPasswordForm] = Form.useForm()

    // Filter & Selection States
    const [searchText, setSearchText] = useState('')
    const [roleFilter, setRoleFilter] = useState<string | null>(null)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

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

    // Filter Logic
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = u.username.toLowerCase().includes(searchText.toLowerCase())
            const matchesRole = roleFilter ? u.role === roleFilter : true
            return matchesSearch && matchesRole
        })
    }, [users, searchText, roleFilter])

    // Actions
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

    const onResetPassword = async (values: { new_password: string }) => {
        if (!resetPasswordUser) return
        try {
            await apiRequest(`/api/auth/users/${resetPasswordUser.id}/password`, {
                method: 'PUT',
                body: JSON.stringify(values),
            })
            message.success('密码重置成功')
            setResetPasswordVisible(false)
            setResetPasswordUser(null)
            resetPasswordForm.resetFields()
        } catch (err: any) {
            message.error(err?.message || '重置失败')
        }
    }

    const handleDelete = async (id: number) => {
        try {
            await apiRequest(`/api/auth/users/${id}`, { method: 'DELETE' })
            message.success('用户已删除')
            fetchUsers()
            // Remove from selection if it was selected
            setSelectedRowKeys(prev => prev.filter(k => k !== id))
        } catch (err: any) {
            message.error(err?.message || '删除失败')
        }
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            await apiRequest('/api/auth/users/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`成功删除 ${selectedRowKeys.length} 个用户`)
            setSelectedRowKeys([])
            fetchUsers()
        } catch (err: any) {
            message.error(err?.message || '批量删除失败')
        }
    }

    const openEditModal = (record: UserRow) => {
        setEditingUser(record)
        editForm.setFieldsValue({ role: record.role })
        setEditModalVisible(true)
    }

    const openResetPasswordModal = (record: UserRow) => {
        setResetPasswordUser(record)
        setResetPasswordVisible(true)
    }

    if (user?.role !== 'super_admin') {
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
            render: (_: any, record: UserRow) => {
                const isSelf = record.username === user.username
                return (
                    <Space>
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(record)}
                        >
                            修改角色
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<KeyOutlined />}
                            onClick={() => openResetPasswordModal(record)}
                        >
                            重置密码
                        </Button>
                        <Popconfirm
                            title="确定删除该用户吗？此操作不可逆。"
                            onConfirm={() => handleDelete(record.id)}
                            disabled={isSelf}
                            okText="删除"
                            cancelText="取消"
                        >
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                disabled={isSelf}
                            >
                                删除
                            </Button>
                        </Popconfirm>
                    </Space>
                )
            },
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">用户与权限管理</h1>
                <p className="page-subtitle" style={{ color: '#1e293b' }}>创建用户账号、分配和修改角色权限</p>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                {/* Toolbar */}
                <Row gutter={16} align="middle" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
                    <Col>
                        <Space>
                            <Input
                                placeholder="搜索用户名"
                                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 200 }}
                                allowClear
                            />
                            <Select
                                placeholder="筛选角色"
                                value={roleFilter}
                                onChange={setRoleFilter}
                                style={{ width: 150 }}
                                allowClear
                                options={ROLE_OPTIONS}
                            />
                            {selectedRowKeys.length > 0 && (
                                <Popconfirm
                                    title={`确定删除选中的 ${selectedRowKeys.length} 个用户吗？`}
                                    onConfirm={handleBatchDelete}
                                    okText="删除"
                                    cancelText="取消"
                                >
                                    <Button type="primary" danger icon={<DeleteOutlined />}>
                                        批量删除 ({selectedRowKeys.length})
                                    </Button>
                                </Popconfirm>
                            )}
                        </Space>
                    </Col>
                    <Col>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                            创建用户
                        </Button>
                    </Col>
                </Row>

                <Table<UserRow>
                    loading={loading}
                    dataSource={filteredUsers}
                    rowKey="id"
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                        getCheckboxProps: (record) => ({
                            disabled: record.username === user.username, // Disable selection for self
                        }),
                    }}
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

            {/* 重置密码模态框 */}
            <Modal
                title={`重置密码 - ${resetPasswordUser?.username}`}
                open={resetPasswordVisible}
                onCancel={() => {
                    setResetPasswordVisible(false)
                    setResetPasswordUser(null)
                    resetPasswordForm.resetFields()
                }}
                footer={null}
                width={400}
            >
                <Form layout="vertical" form={resetPasswordForm} onFinish={onResetPassword}>
                    <Form.Item
                        name="new_password"
                        label="新密码"
                        rules={[
                            { required: true, message: '请输入新密码' },
                            { min: 6, message: '密码至少6个字符' }
                        ]}
                    >
                        <Input.Password placeholder="请输入新密码" />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setResetPasswordVisible(false)
                                setResetPasswordUser(null)
                                resetPasswordForm.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                确认重置
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div >
    )
}
