import { useState, useMemo } from 'react'
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, Tag, Drawer, Descriptions, Card, Checkbox, Row, Col, Popconfirm } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Resource } from '@/types'

const RESOURCE_TYPES = ['酒店', '门票', '餐饮', '交通', '组合', '其他']

interface FilterState {
    keyword: string
    types: string[]
    poi_id: string | null
    status: string | null
}

export default function ResourceListPage() {
    const { data, refresh } = useData()
    const resources = data?.resources ?? []
    const poiList = data?.poi ?? []
    const suppliers = data?.suppliers ?? []
    const supplierResources = data?.supplier_resources ?? []
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
    const [editModalVisible, setEditModalVisible] = useState(false)
    const [form] = Form.useForm()
    const [editForm] = Form.useForm()
    const [batchUpdateForm] = Form.useForm()
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)

    // 筛选器状态
    const [filters, setFilters] = useState<FilterState>({
        keyword: '',
        types: [],
        poi_id: null,
        status: null,
    })

    // 过滤逻辑
    const filteredResources = useMemo(() => {
        return resources.filter((r) => {
            // 关键词搜索（名称）
            if (filters.keyword && !r.resource_name.toLowerCase().includes(filters.keyword.toLowerCase())) {
                return false
            }
            // 类型筛选
            if (filters.types.length > 0 && !filters.types.includes(r.resource_type)) {
                return false
            }
            // POI筛选
            if (filters.poi_id && r.poi_id !== filters.poi_id) {
                return false
            }
            // 状态筛选
            if (filters.status && r.status !== filters.status) {
                return false
            }
            return true
        })
    }, [resources, filters])


    // 创建资源并同时绑定供应商
    const handleCreateResource = async (values: any) => {
        try {
            // 1. 先创建资源
            const resourcePayload = {
                poi_id: values.poi_id,
                resource_name: values.resource_name,
                resource_type: values.resource_type,
                status: 'active',
            }
            const newResource = await apiRequest<{ id: string }>('/api/resources', {
                method: 'POST',
                body: JSON.stringify(resourcePayload),
            })

            // 2. 再创建供应商-资源绑定关系
            for (const binding of values.supplier_bindings) {
                const bindingPayload = {
                    supplier_id: binding.supplier_id,
                    resource_id: newResource.id,
                    settlement_price: binding.settlement_price,
                    supply_status: 'active',
                }
                await apiRequest('/api/supplier-resources', {
                    method: 'POST',
                    body: JSON.stringify(bindingPayload),
                })
            }

            message.success('资源创建成功，已绑定供应商')
            setCreateModalVisible(false)
            form.resetFields()
            await refresh()
        } catch (err: any) {
            if (err.message?.includes('duplicate')) {
                message.warning('该POI下已存在同名同类型的资源')
            } else {
                message.error(err.message || '创建失败')
            }
        }
    }

    const handleUpdateResource = async (values: any) => {
        if (!selectedResource) return
        try {
            await apiRequest(`/api/resources/${selectedResource.id}`, {
                method: 'PUT',
                body: JSON.stringify(values)
            })
            message.success('资源已更新')
            setEditModalVisible(false)
            setSelectedResource(null)
            await refresh()
        } catch (err: any) {
            message.error(err.message || '更新失败')
        }
    }

    const deleteResource = async (id: string) => {
        try {
            await apiRequest(`/api/resources/${id}`, { method: 'DELETE' })
            message.success('资源已删除')
            await refresh()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            await apiRequest('/api/resources/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`已删除 ${selectedRowKeys.length} 个资源`)
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量删除失败')
        }
    }

    const handleBatchUpdate = async (values: any) => {
        if (selectedRowKeys.length === 0) return
        try {
            // Remove empty fields
            const fields: any = {}
            if (values.status) fields.status = values.status
            if (values.resource_type) fields.resource_type = values.resource_type

            if (Object.keys(fields).length === 0) {
                message.warning('请至少输入一个要修改的字段')
                return
            }

            await apiRequest('/api/resources/batch-update', {
                method: 'POST',
                body: JSON.stringify({
                    ids: selectedRowKeys,
                    fields
                })
            })
            message.success(`已更新 ${selectedRowKeys.length} 个资源`)
            setBatchUpdateVisible(false)
            batchUpdateForm.resetFields()
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
    }

    // 获取资源关联的供应商列表
    const getResourceSuppliers = (resourceId: string) => {
        return supplierResources
            .filter((sr) => sr.resource_id === resourceId)
            .map((sr) => ({
                ...sr,
                supplier: suppliers.find((s) => s.id === sr.supplier_id),
            }))
    }

    const columns: any = [
        {
            title: '资源名称',
            dataIndex: 'resource_name',
            sorter: (a: Resource, b: Resource) => a.resource_name.localeCompare(b.resource_name),
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
            onFilter: (value: string, record: Resource) =>
                record.resource_name.toLowerCase().includes(value.toLowerCase()),
        },
        {
            title: '资源类型',
            dataIndex: 'resource_type',
            render: (v: string) => <Tag color="blue">{v}</Tag>,
            filters: RESOURCE_TYPES.map(t => ({ text: t, value: t })),
            onFilter: (value: string, record: Resource) => record.resource_type === value,
        },
        {
            title: '关联POI',
            dataIndex: 'poi_id',
            render: (v: string) => poiList.find((p) => p.id === v)?.poi_name || '-',
            sorter: (a: Resource, b: Resource) => {
                const poiA = poiList.find(p => p.id === a.poi_id)?.poi_name || ''
                const poiB = poiList.find(p => p.id === b.poi_id)?.poi_name || ''
                return poiA.localeCompare(poiB)
            },
        },
        {
            title: '供应商数',
            render: (_: any, record: Resource) => {
                const count = getResourceSuppliers(record.id).length
                return count
            },
            sorter: (a: Resource, b: Resource) => getResourceSuppliers(a.id).length - getResourceSuppliers(b.id).length,
        },
        {
            title: '供应商详情',
            render: (_: any, record: Resource) => {
                const bindings = getResourceSuppliers(record.id)
                if (bindings.length === 0) return <Tag color="red">未绑定</Tag>
                return (
                    <Space size={4} wrap>
                        {bindings.slice(0, 2).map((b) => (
                            <Tag key={b.id}>{b.supplier?.supplier_name}</Tag>
                        ))}
                        {bindings.length > 2 && <Tag>+{bindings.length - 2}</Tag>}
                    </Space>
                )
            },
            width: 200,
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => {
                const map: any = { active: '启用', inactive: '停用' }
                return <Tag color={v === 'active' ? 'green' : 'gray'}>{map[v] || v}</Tag>
            },
            filters: [
                { text: '启用', value: 'active' },
                { text: '停用', value: 'inactive' },
            ],
            onFilter: (value: string, record: Resource) => (record.status || 'active') === value,
        },
        {
            title: '操作',
            width: 200,
            render: (_: any, record: Resource) => (
                <Space>
                    <Button type="link" size="small" onClick={() => setSelectedResource(record)}>
                        查看
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                            setSelectedResource(record)
                            editForm.setFieldsValue(record)
                            setEditModalVisible(true)
                        }}
                    >
                        编辑
                    </Button>
                    <Popconfirm
                        title="确定删除该资源吗？"
                        description="删除资源会同时删除所有关联的供应商绑定信息"
                        onConfirm={() => deleteResource(record.id)}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                    >
                        <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">资源管理</h1>
                    <p className="page-subtitle">管理所有资源，创建资源时必须绑定供应商</p>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                    新建资源
                </Button>
            </div>

            {/* 高级筛选器 */}
            <Card size="small" style={{ marginBottom: 16 }} bodyStyle={{ padding: '16px' }}>
                <Form layout="inline" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]} style={{ width: '100%' }}>
                        <Col span={6}>
                            <Form.Item label="关键词" style={{ marginBottom: 0, width: '100%' }}>
                                <Input
                                    placeholder="搜索资源名称"
                                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                    value={filters.keyword}
                                    onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="关联POI" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部POI"
                                    showSearch
                                    allowClear
                                    optionFilterProp="label"
                                    options={poiList.map(p => ({ value: p.id, label: p.poi_name }))}
                                    value={filters.poi_id}
                                    onChange={v => setFilters({ ...filters, poi_id: v })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="状态" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部状态"
                                    allowClear
                                    options={[
                                        { value: 'active', label: '启用' },
                                        { value: 'inactive', label: '停用' },
                                    ]}
                                    value={filters.status}
                                    onChange={v => setFilters({ ...filters, status: v })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6} style={{ textAlign: 'right' }}>
                            {selectedRowKeys.length > 0 && (
                                <Space>
                                    <Button onClick={() => setBatchUpdateVisible(true)} icon={<SettingOutlined />}>
                                        批量修改
                                    </Button>
                                    <Popconfirm
                                        title={`确定删除选中的 ${selectedRowKeys.length} 个资源吗？`}
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
                        <Col span={24}>
                            <Form.Item label="资源类型" style={{ marginBottom: 0 }}>
                                <Checkbox.Group
                                    options={RESOURCE_TYPES}
                                    value={filters.types}
                                    onChange={v => setFilters({ ...filters, types: v as string[] })}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Card>

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Resource>
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredResources}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`
                    }}
                />
            </div>

            {/* 创建资源Modal */}
            <Modal
                title="创建资源"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false)
                    form.resetFields()
                }}
                footer={null}
                width={600}
            >
                {/* ... existing form content ... */}
                <Form form={form} layout="vertical" onFinish={handleCreateResource}>
                    <Form.Item name="poi_id" label="所属POI" rules={[{ required: true, message: '请选择POI' }]}>
                        <Select
                            placeholder="选择POI"
                            showSearch
                            optionFilterProp="label"
                            options={poiList.map((p) => ({ value: p.id, label: `${p.poi_name} (${p.city})` }))}
                        />
                    </Form.Item>
                    <Form.Item name="resource_name" label="资源名称" rules={[{ required: true, message: '请输入资源名称' }]}>
                        <Input placeholder="例如：标准双床房" />
                    </Form.Item>
                    <Form.Item name="resource_type" label="资源类型" rules={[{ required: true, message: '请选择资源类型' }]}>
                        <Select
                            placeholder="选择类型"
                            options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))}
                        />
                    </Form.Item>

                    <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                        <h4 style={{ marginBottom: 12 }}>供应商绑定 <span style={{ color: 'red' }}>*</span></h4>
                        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                            每个资源必须至少绑定一个供应商。同一资源可以有多个供应商，每个供应商有独立的结算价。
                        </p>
                        <Form.List
                            name="supplier_bindings"
                            rules={[
                                {
                                    validator: async (_, bindings) => {
                                        if (!bindings || bindings.length < 1) {
                                            return Promise.reject(new Error('至少需要绑定一个供应商'))
                                        }
                                    },
                                },
                            ]}
                        >
                            {(fields, { add, remove }, { errors }) => (
                                <>
                                    {fields.map(({ key, name, ...restField }) => (
                                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'supplier_id']}
                                                rules={[{ required: true, message: '请选择供应商' }]}
                                                style={{ marginBottom: 0, width: 200 }}
                                            >
                                                <Select
                                                    placeholder="选择供应商"
                                                    showSearch
                                                    optionFilterProp="label"
                                                    options={suppliers.map((s) => ({ value: s.id, label: s.supplier_name }))}
                                                />
                                            </Form.Item>
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'settlement_price']}
                                                rules={[{ required: true, message: '请输入结算价' }]}
                                                style={{ marginBottom: 0, width: 120 }}
                                            >
                                                <InputNumber placeholder="结算价" min={0} style={{ width: '100%' }} prefix="¥" />
                                            </Form.Item>
                                            {fields.length > 1 && (
                                                <Button type="link" danger onClick={() => remove(name)}>
                                                    删除
                                                </Button>
                                            )}
                                        </Space>
                                    ))}
                                    <Form.Item style={{ marginBottom: 0 }}>
                                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                            添加供应商
                                        </Button>
                                        <Form.ErrorList errors={errors} />
                                    </Form.Item>
                                </>
                            )}
                        </Form.List>
                    </div>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setCreateModalVisible(false)
                                form.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                创建资源
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 编辑资源Modal */}
            <Modal
                title={`编辑资源: ${selectedResource?.resource_name}`}
                open={editModalVisible}
                onCancel={() => {
                    setEditModalVisible(false)
                    setSelectedResource(null)
                }}
                footer={null}
            >
                <Form form={editForm} layout="vertical" onFinish={handleUpdateResource}>
                    <Form.Item name="resource_name" label="资源名称" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="resource_type" label="资源类型" rules={[{ required: true }]}>
                        <Select options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))} />
                    </Form.Item>
                    <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                        <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
                    </Form.Item>
                    <Space style={{ float: 'right', marginTop: 16 }}>
                        <Button onClick={() => setEditModalVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">保存</Button>
                    </Space>
                </Form>
            </Modal>

            {/* 批量更新 Modal */}
            <Modal
                title={`批量修改已选的 ${selectedRowKeys.length} 个资源`}
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
                            { value: 'active', label: '启用' },
                            { value: 'inactive', label: '停用' },
                        ]} allowClear placeholder="批量修改状态" />
                    </Form.Item>
                    <Form.Item name="resource_type" label="资源类型">
                        <Select options={RESOURCE_TYPES.map(t => ({ value: t, label: t }))} allowClear placeholder="批量修改类型" />
                    </Form.Item>
                    <Space style={{ float: 'right', marginTop: 16 }}>
                        <Button onClick={() => setBatchUpdateVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">
                            确认修改
                        </Button>
                    </Space>
                </Form>
            </Modal>

            {/* 资源详情Drawer */}
            <Drawer
                title={selectedResource?.resource_name}
                open={!!selectedResource && !editModalVisible}
                onClose={() => setSelectedResource(null)}
                width={600}
            >
                {selectedResource && (
                    <>
                        <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="资源名称">{selectedResource.resource_name}</Descriptions.Item>
                            <Descriptions.Item label="资源类型">
                                <Tag color="blue">{selectedResource.resource_type}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="所属POI">
                                {poiList.find((p) => p.id === selectedResource.poi_id)?.poi_name || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={selectedResource.status === 'active' ? 'green' : 'gray'}>
                                    {selectedResource.status === 'active' ? '启用' : selectedResource.status === 'inactive' ? '停用' : selectedResource.status || '启用'}
                                </Tag>
                            </Descriptions.Item>
                        </Descriptions>

                        <h4 style={{ marginBottom: 12 }}>供应商绑定信息</h4>
                        <Table
                            size="small"
                            pagination={false}
                            rowKey="id"
                            dataSource={getResourceSuppliers(selectedResource.id)}
                            columns={[
                                {
                                    title: '供应商',
                                    dataIndex: ['supplier', 'supplier_name'],
                                    render: (v: string) => v || '-',
                                },
                                {
                                    title: '结算价',
                                    dataIndex: 'settlement_price',
                                    render: (v: number) => v ? `¥${v}` : '-'
                                },
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
                    </>
                )}
            </Drawer>
        </div>
    )
}
