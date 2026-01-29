import { useState, useEffect } from 'react'
import { Table, Button, Space, Modal, Form, Input, message, Card, Row, Col, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import type { Spu } from '@/types'

export default function SPUListPage() {
    const { data, loadData } = useData()
    useEffect(() => {
        loadData(['spus'])
    }, [loadData])
    const spus = data.spus ?? []
    const navigate = useNavigate()
    const [modalVisible, setModalVisible] = useState(false)
    const [editingSpu, setEditingSpu] = useState<Spu | null>(null)
    const [form] = Form.useForm()
    const [keyword, setKeyword] = useState('')

    const filteredSpus = spus.filter(s =>
        !keyword || s.name.toLowerCase().includes(keyword.toLowerCase()) ||
        (s.spu_code && s.spu_code.toLowerCase().includes(keyword.toLowerCase()))
    )

    const handleSave = async (values: any) => {
        try {
            const payload = { ...values }
            if (editingSpu) {
                await apiRequest(`/api/spus/${editingSpu.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                })
                message.success('SPU 更新成功')
            } else {
                await apiRequest('/api/spus', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                })
                message.success('SPU 创建成功')
            }
            setModalVisible(false)
            setEditingSpu(null)
            form.resetFields()
            await loadData(['spus'], { force: true })
        } catch (err: any) {
            message.error(err.message || '操作失败')
        }
    }

    const handleDelete = async (id: number) => {
        try {
            await apiRequest(`/api/spus/${id}`, { method: 'DELETE' })
            message.success('删除成功')
            await loadData(['spus'], { force: true })
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const openModal = (record: Spu | null) => {
        setEditingSpu(record)
        if (record) {
            form.setFieldsValue(record)
        } else {
            form.resetFields()
        }
        setModalVisible(true)
    }

    const columns: any = [
        {
            title: 'SPU 名称',
            dataIndex: 'name',
            sorter: (a: Spu, b: Spu) => a.name.localeCompare(b.name),
        },
        {
            title: 'SPU 分类',
            dataIndex: 'category',
            sorter: (a: Spu, b: Spu) => (a.category || '').localeCompare(b.category || ''),
        },
        {
            title: '编码',
            dataIndex: 'spu_code',
        },
        {
            title: 'SKU 数量',
            dataIndex: 'sku_count',
            sorter: (a: Spu, b: Spu) => (a.sku_count || 0) - (b.sku_count || 0),
        },
        {
            title: '备注',
            dataIndex: 'remark',
            ellipsis: true,
        },
        {
            title: '最后更新',
            dataIndex: 'updated_at',
            render: (v: string) => v ? new Date(v).toLocaleString() : '-',
            sorter: (a: Spu, b: Spu) => new Date(a.updated_at || '').getTime() - new Date(b.updated_at || '').getTime(),
        },
        {
            title: '操作',
            render: (_: any, record: Spu) => (
                <Space>
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/skus/list?spu_id=${record.id}`)}
                    >
                        查看/编辑SKU
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openModal(record)}
                    >
                        编辑
                    </Button>
                    <Popconfirm title="确定删除吗？" onConfirm={() => handleDelete(Number(record.id))}>
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">SPU 管理</h1>
                    <p className="page-subtitle">标准产品单位管理</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
                    新建 SPU
                </Button>
            </div>

            <Card size="small" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                    <Col span={8}>
                        <Input
                            placeholder="搜索 SPU 名称或编码"
                            prefix={<SearchOutlined />}
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            allowClear
                        />
                    </Col>
                </Row>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredSpus}
                />
            </div>

            <Modal
                title={editingSpu ? "编辑 SPU" : "新建 SPU"}
                open={modalVisible}
                onCancel={() => setModalVisible(false)}
                footer={null}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="name" label="SPU 名称" rules={[{ required: true, message: '请输入名称' }]}>
                        <Input placeholder="例如：北京三日游" />
                    </Form.Item>
                    <Form.Item name="spu_code" label="SPU 编码">
                        <Input placeholder="例如：SPU001" />
                    </Form.Item>
                    <Form.Item name="category" label="SPU 分类">
                        <Input placeholder="例如：跟团游" />
                    </Form.Item>
                    <Form.Item name="remark" label="备注">
                        <Input.TextArea rows={4} />
                    </Form.Item>
                    <Space style={{ float: 'right' }}>
                        <Button onClick={() => setModalVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">保存</Button>
                    </Space>
                </Form>
            </Modal>
        </div>
    )
}
