import { useState } from 'react'
import { Table, Button, Space, Modal, Form, Input, Popconfirm, Tag, message, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'

export default function ProductCategoryPage() {
    const { data, refresh } = useData()
    const categories = data?.product_categories ?? []
    const products = data?.products ?? []

    const [isModalVisible, setIsModalVisible] = useState(false)
    const [editingCategory, setEditingCategory] = useState<any>(null)
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)

    const handleSave = async (values: any) => {
        setLoading(true)
        try {
            if (editingCategory) {
                await apiRequest(`/api/product-categories/${editingCategory.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(values)
                })
                message.success('分类已更新')
            } else {
                await apiRequest('/api/product-categories', {
                    method: 'POST',
                    body: JSON.stringify(values)
                })
                message.success('分类已创建')
            }
            setIsModalVisible(false)
            setEditingCategory(null)
            form.resetFields()
            await refresh()
        } catch (err: any) {
            message.error(err.message || '操作失败')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await apiRequest(`/api/product-categories/${id}`, { method: 'DELETE' })
            message.success('分类已删除')
            await refresh()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const openModal = (record: any = null) => {
        setEditingCategory(record)
        if (record) {
            form.setFieldsValue(record)
        } else {
            form.resetFields()
        }
        setIsModalVisible(true)
    }

    const columns = [
        {
            title: '分类名称',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
        },

        {
            title: '关联产品数',
            key: 'count',
            render: (_: any, record: any) => {
                const count = products.filter(p => String(p.category_id) === String(record.id)).length
                return count > 0 ? <Tag color="blue">{count}</Tag> : '-'
            }
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: any) => {
                const isLocked = products.some(p => String(p.category_id) === String(record.id))
                return (
                    <Space size="middle">
                        <Button
                            icon={<EditOutlined />}
                            size="small"
                            type="link"
                            onClick={() => openModal(record)}
                        >
                            编辑
                        </Button>
                        {isLocked ? (
                            <Tooltip title="该分类下已有产品，不可删除">
                                <Button icon={<DeleteOutlined />} size="small" type="link" danger disabled>
                                    删除
                                </Button>
                            </Tooltip>
                        ) : (
                            <Popconfirm
                                title="确定删除该分类吗?"
                                onConfirm={() => handleDelete(record.id)}
                                okText="确定"
                                cancelText="取消"
                            >
                                <Button icon={<DeleteOutlined />} size="small" type="link" danger>
                                    删除
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                )
            },
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">产品分类管理</h1>
                    <p className="page-subtitle">管理产品的分类属性</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                    新建分类
                </Button>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table
                    columns={columns}
                    dataSource={categories}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </div>

            <Modal
                title={editingCategory ? "编辑分类" : "新建分类"}
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                >
                    <Form.Item
                        name="name"
                        label="分类名称"
                        rules={[{ required: true, message: '请输入分类名称' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="描述"
                    >
                        <Input.TextArea />
                    </Form.Item>

                    <Form.Item>
                        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button onClick={() => setIsModalVisible(false)}>取消</Button>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                保存
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}
