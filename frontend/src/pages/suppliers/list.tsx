import { useState, useMemo, useEffect } from 'react'
import { Button, Descriptions, Drawer, Form, Input, Select, Space, Table, Tag, message, Card, Row, Col, Popconfirm, Modal, Tooltip } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import type { Supplier } from '@/types'
import { apiRequest } from '@/lib/api'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'

interface FilterState {
    keyword: string
}

export default function SupplierPage() {
    const { data, refresh } = useData()
    const [supplierForm] = Form.useForm()
    const [editForm] = Form.useForm()
    const [batchUpdateForm] = Form.useForm()
    const [selected, setSelected] = useState<Supplier | null>(null)
    const [detailAutoOpened, setDetailAutoOpened] = useState(false)
    const suppliers = data?.suppliers ?? []
    const resources = data?.resources ?? []
    const supplierResources = data?.supplier_resources ?? []
    const [searchParams] = useSearchParams()
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [editModalVisible, setEditModalVisible] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

    // 筛选器状态
    const [filters, setFilters] = useState<FilterState>({
        keyword: '',
    })

    // 过滤逻辑
    const filteredSuppliers = useMemo(() => {
        return suppliers.filter((s) => {
            // 关键词搜索（名称或联系人或电话）
            if (filters.keyword) {
                const kw = filters.keyword.toLowerCase()
                const nameMatch = s.supplier_name.toLowerCase().includes(kw)
                const contactMatch = s.contact_info?.contact_name?.toLowerCase().includes(kw)
                const phoneMatch = s.contact_info?.contact_phone?.includes(kw)
                if (!nameMatch && !contactMatch && !phoneMatch) {
                    return false
                }
            }

            return true
        })
    }, [suppliers, filters])

    const createSupplier = async (values: any) => {
        try {
            const payload = {
                supplier_name: values.supplier_name,
                status: values.status || 'active',
                contact_info: {
                    contact_name: values.contact_name,
                    contact_phone: values.contact_phone,
                },
            }
            await apiRequest('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) })
            message.success('供应商已创建')
            supplierForm.resetFields()
            setCreateModalVisible(false)
            await refresh()
        } catch (err: any) {
            message.error(err.message || '创建失败')
        }
    }

    const updateSupplier = async (values: any) => {
        if (!selected) return
        try {
            const payload = {
                supplier_name: values.supplier_name,
                status: values.status,
                contact_info: {
                    contact_name: values.contact_name,
                    contact_phone: values.contact_phone,
                },
            }
            if (
                selected.supplier_name === payload.supplier_name &&
                selected.status === payload.status &&
                selected.contact_info?.contact_name === payload.contact_info.contact_name &&
                selected.contact_info?.contact_phone === payload.contact_info.contact_phone
            ) {
                message.info('没有变更，无需保存')
                setEditModalVisible(false)
                setSelected(null)
                return
            }
            await apiRequest(`/api/suppliers/${selected.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            })
            message.success('供应商已更新')
            setEditModalVisible(false)
            setSelected(null)
            await refresh()
        } catch (err: any) {
            message.error(err.message || '更新失败')
        }
    }

    const deleteSupplier = async (id: string) => {
        try {
            await apiRequest(`/api/suppliers/${id}`, { method: 'DELETE' })
            message.success('供应商已删除')
            await refresh()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            await apiRequest('/api/suppliers/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`已删除 ${selectedRowKeys.length} 个供应商`)
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量删除失败')
        }
    }

    const handleBatchUpdate = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            // Remove empty fields
            const fields: any = {}


            if (Object.keys(fields).length === 0) {
                message.warning('请至少输入一个要修改的字段')
                return
            }

            await apiRequest('/api/suppliers/batch-update', {
                method: 'POST',
                body: JSON.stringify({
                    ids: selectedRowKeys,
                    fields
                })
            })
            message.success(`已更新 ${selectedRowKeys.length} 个供应商`)
            setBatchUpdateVisible(false)
            batchUpdateForm.resetFields()
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
    }

    const columns: any = [
        {
            title: '供应商名称',
            dataIndex: 'supplier_name',
            sorter: (a: Supplier, b: Supplier) => a.supplier_name.localeCompare(b.supplier_name),
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="搜索名称"
                        value={selectedKeys[0]}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{ width: 188, marginBottom: 8, display: 'block' }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() => confirm()}
                            icon={<SearchOutlined />}
                            size="small"
                            style={{ width: 90 }}
                        >
                            搜索
                        </Button>
                        <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
                            重置
                        </Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
            onFilter: (value: string, record: Supplier) =>
                record.supplier_name.toLowerCase().includes(value.toLowerCase()),
        },
        {
            title: '联系人',
            dataIndex: 'contact_info',
            render: (info: any) => info?.contact_name || '-',
            sorter: (a: Supplier, b: Supplier) => (a.contact_info?.contact_name || '').localeCompare(b.contact_info?.contact_name || ''),
        },
        {
            title: '电话',
            dataIndex: 'contact_info',
            render: (info: any) => info?.contact_phone || '-',
        },
        {
            title: '绑定资源数',
            render: (_: any, record: Supplier) => supplierResources.filter((sr) => sr.supplier_id === record.id).length,
            sorter: (a: Supplier, b: Supplier) => {
                const countA = supplierResources.filter(sr => sr.supplier_id === a.id).length
                const countB = supplierResources.filter(sr => sr.supplier_id === b.id).length
                return countA - countB
            }
        },

        {
            title: '操作',
            width: 200,
            render: (_: any, record: Supplier) => {
                const bindingCount = supplierResources.filter(sr => sr.supplier_id === record.id).length
                const isLocked = bindingCount > 0

                return (
                    <Space>
                        <Button type="link" size="small" onClick={() => setSelected(record)}>
                            查看详情
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                                setSelected(record)
                                editForm.setFieldsValue({
                                    supplier_name: record.supplier_name,
                                    contact_phone: record.contact_info?.contact_phone,
                                })
                                setEditModalVisible(true)
                            }}
                        >
                            编辑
                        </Button>
                        {isLocked ? (
                            <Tooltip title="该供应商已绑定资源(数量不为0)，不可删除">
                                <Button type="link" danger disabled size="small" icon={<DeleteOutlined />}>
                                    删除
                                </Button>
                            </Tooltip>
                        ) : (
                            <Popconfirm
                                title="确定删除该供应商吗？"
                                description="删除供应商可能影响关联的资源供应，请谨慎操作"
                                onConfirm={() => deleteSupplier(record.id)}
                                okText="删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                            >
                                <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                                    删除
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                )
            },
        },
    ]

    // 获取供应商绑定的资源列表
    const supplyList = useMemo(
        () =>
            supplierResources
                .filter((sr) => sr.supplier_id === selected?.id)
                .map((sr) => ({ ...sr, resource: resources.find((r) => r.id === sr.resource_id) })),
        [resources, selected?.id, supplierResources]
    )

    useEffect(() => {
        if (searchParams.get('detail') && !detailAutoOpened && suppliers.length) {
            setSelected(suppliers[0])
            setDetailAutoOpened(true)
        }
    }, [searchParams, suppliers, detailAutoOpened])


    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">供应商管理</h1>
                    <p className="page-subtitle">供应商基础信息管理，绑定资源请在资源管理中操作</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                    新建供应商
                </Button>
            </div>

            {/* 高级筛选器 */}
            <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '16px' } }}>
                <Form layout="inline" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]} style={{ width: '100%' }}>
                        <Col span={8}>
                            <Form.Item label="关键词" style={{ marginBottom: 0, width: '100%' }}>
                                <Input
                                    placeholder="搜索供应商名称、联系人或电话"
                                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                    value={filters.keyword}
                                    onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                                    allowClear
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8} style={{ textAlign: 'right' }}>
                            {selectedRowKeys.length > 0 && (
                                <Space>
                                    <Button onClick={() => setBatchUpdateVisible(true)} icon={<SettingOutlined />}>
                                        批量修改
                                    </Button>
                                    <Popconfirm
                                        title={`确定删除选中的 ${selectedRowKeys.length} 个供应商吗？`}
                                        onConfirm={handleBatchDelete}
                                        okText="确定删除"
                                        cancelText="取消"
                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button danger icon={<DeleteOutlined />}>
                                            批量删除
                                        </Button>
                                    </Popconfirm>
                                </Space>
                            )}
                        </Col>
                    </Row>
                </Form>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Supplier>
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredSuppliers}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: filteredSuppliers.length,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
                        onShowSizeChange: (current, size) => setPagination({ current, pageSize: size })
                    }}
                    onChange={(p) => setPagination({ current: p.current || 1, pageSize: p.pageSize || 10 })}
                />
            </div>

            {/* 新建供应商Modal */}
            <Drawer
                title="新建供应商"
                open={createModalVisible}
                onClose={() => {
                    setCreateModalVisible(false)
                    supplierForm.resetFields()
                }}
                width={400}
            >
                <Form layout="vertical" form={supplierForm} onFinish={createSupplier}>
                    <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
                        <Input placeholder="例如：北京旅游集散中心" />
                    </Form.Item>
                    <Form.Item name="contact_name" label="联系人">
                        <Input placeholder="张三" />
                    </Form.Item>
                    <Form.Item name="contact_phone" label="电话">
                        <Input placeholder="138****" />
                    </Form.Item>
                    <Form.Item name="status" label="状态" initialValue="active">
                        <Select options={[
                            { value: 'active', label: '合作中' },
                            { value: 'pending', label: '待审核' },
                            { value: 'inactive', label: '已停用' }
                        ]} />
                    </Form.Item>
                    <Form.Item style={{ marginTop: 24 }}>
                        <Space style={{ width: '100%' }}>
                            <Button onClick={() => {
                                setCreateModalVisible(false)
                                supplierForm.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                创建供应商
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Drawer>

            {/* 编辑供应商Modal */}
            <Modal
                title={`编辑供应商: ${selected?.supplier_name} `}
                open={editModalVisible}
                onCancel={() => {
                    setEditModalVisible(false)
                    setSelected(null)
                }}
                footer={null}
            >
                <Form layout="vertical" form={editForm} onFinish={updateSupplier}>
                    <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="contact_name" label="联系人">
                        <Input />
                    </Form.Item>
                    <Form.Item name="contact_phone" label="电话">
                        <Input />
                    </Form.Item>
                    <Form.Item name="status" label="状态">
                        <Select options={[
                            { value: 'active', label: '合作中' },
                            { value: 'pending', label: '待审核' },
                            { value: 'inactive', label: '已停用' }
                        ]} />
                    </Form.Item>
                    <Space style={{ float: 'right', marginTop: 16 }}>
                        <Button onClick={() => setEditModalVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">保存</Button>
                    </Space>
                </Form>
            </Modal>

            {/* 批量更新 Modal */}
            <Modal
                title={`批量修改已选的 ${selectedRowKeys.length} 个供应商`}
                open={batchUpdateVisible}
                onCancel={() => setBatchUpdateVisible(false)}
                footer={null}
            >
                <Form layout="vertical" form={batchUpdateForm} onFinish={handleBatchUpdate}>
                    <p style={{ color: '#999', marginBottom: 16 }}>
                        请填写需要修改的字段，留空则不修改
                    </p>
                    <Form.Item name="status" label="状态">
                        <Select options={[
                            { value: 'active', label: '合作中' },
                            { value: 'pending', label: '待审核' },
                            { value: 'inactive', label: '已停用' }
                        ]} allowClear placeholder="批量修改状态" />
                    </Form.Item>
                    <Space style={{ float: 'right', marginTop: 16 }}>
                        <Button onClick={() => setBatchUpdateVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">
                            确认修改
                        </Button>
                    </Space>
                </Form>
            </Modal>

            {/* 供应商详情Drawer */}
            <Drawer
                title={selected?.supplier_name}
                open={!!selected && !editModalVisible}
                width={720}
                onClose={() => setSelected(null)}
            >
                {selected && (
                    <>
                        <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="供应商名称">{selected.supplier_name}</Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={selected.status === 'active' ? 'green' : selected.status === 'pending' ? 'orange' : 'gray'}>
                                    {selected.status === 'active' ? '合作中' : selected.status === 'pending' ? '待审核' : selected.status === 'inactive' ? '已停用' : selected.status}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="联系人">{selected.contact_info?.contact_name || '-'}</Descriptions.Item>
                            <Descriptions.Item label="电话">{selected.contact_info?.contact_phone || '-'}</Descriptions.Item>
                        </Descriptions>

                        <h4 style={{ margin: '16px 0' }}>已绑定的资源</h4>
                        <Table
                            size="small"
                            pagination={false}
                            rowKey="id"
                            dataSource={supplyList}
                            locale={{ emptyText: '该供应商暂未绑定任何资源，请在资源管理中创建资源时绑定供应商' }}
                            columns={[
                                { title: '资源名称', dataIndex: ['resource', 'resource_name'] },
                                { title: '资源类型', dataIndex: ['resource', 'resource_type'] },
                                { title: '结算价', dataIndex: 'settlement_price', render: (v: number) => v ? `¥${v} ` : '-' },
                                {
                                    title: '供应状态',
                                    dataIndex: 'supply_status',
                                    render: (v: string) => {
                                        const map: any = { active: '启用', inactive: '停用' }
                                        return <Tag color={v === 'active' ? 'green' : 'gray'}>{map[v] || v}</Tag>
                                    }
                                },
                            ]}
                        />

                        <p style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
                            💡 供应商与资源的绑定关系在资源管理中维护。创建资源时必须选择至少一个供应商。
                        </p>
                    </>
                )}
            </Drawer>
        </div>
    )
}
