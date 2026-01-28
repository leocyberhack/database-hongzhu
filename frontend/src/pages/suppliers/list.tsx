import { useState, useMemo, useEffect } from 'react'
import { Button, Descriptions, Drawer, Form, Input, Space, Table, Tag, message, Card, Row, Col, Popconfirm, Modal, Tooltip, DatePicker } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import type { Supplier, SupplierContact } from '@/types'
import { apiRequest } from '@/lib/api'
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, SettingOutlined, FolderOpenOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ContactTableEditor from '@/components/ContactTableEditor'
import SupplierFileModal from '@/components/SupplierFileModal'

interface FilterState {
    keyword: string
}

const supplierAttrKeys = [
    'supplier_code',
    'business_scope',
    'license_no',
    'legal_person',
    'credit_code',
    'settlement_cycle',
    'settlement_method',
    'invoice_info',
    'contract_no',
] as const

type SupplierAttrKey = typeof supplierAttrKeys[number]

const normalizeAttrValue = (value: unknown) => {
    if (value === undefined || value === null) return undefined
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed ? trimmed : undefined
    }
    return value
}

const normalizeContactItem = (value: any): SupplierContact | null => {
    if (!value || typeof value !== 'object') return null
    const name = normalizeAttrValue(value.name ?? value.contact_name) as string | undefined
    const phone = normalizeAttrValue(value.phone ?? value.contact_phone) as string | undefined
    const email = normalizeAttrValue(value.email ?? value.contact_email) as string | undefined
    const position = normalizeAttrValue(value.position) as string | undefined
    if (!name && !phone && !email && !position) return null
    return { name, phone, email, position }
}

const normalizeContacts = (value: unknown): SupplierContact[] => {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeContactItem(item)).filter(Boolean) as SupplierContact[]
    }
    if (value && typeof value === 'object') {
        const single = normalizeContactItem(value)
        return single ? [single] : []
    }
    return []
}


const buildSupplierAttrs = (values: Record<string, unknown>, existing?: Supplier) => {
    const base: Record<string, unknown> = { ...(existing?.attrs ?? {}) }
    supplierAttrKeys.forEach((key) => {
        const nextValue = normalizeAttrValue(values[key])
        if (nextValue === undefined) {
            delete base[key]
        } else {
            base[key] = nextValue
        }
    })
    return base
}

const formatDateValue = (value: any) => {
    if (value === null) return null
    if (value && typeof value.format === 'function') {
        return value.format('YYYY-MM-DD')
    }
    return undefined
}

const formatAttrDisplay = (value: unknown) => {
    const normalized = normalizeAttrValue(value)
    return normalized === undefined ? '-' : String(normalized)
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
    const [fileManagerSupplier, setFileManagerSupplier] = useState<Supplier | null>(null)
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
                const contacts = normalizeContacts(s.contact_info)
                const contactMatch = contacts.some((c) =>
                    [c.name, c.phone, c.email, c.position].some((value) =>
                        value ? String(value).toLowerCase().includes(kw) : false
                    )
                )
                if (!nameMatch && !contactMatch) {
                    return false
                }
            }

            return true
        })
    }, [suppliers, filters])

    const createSupplier = async (values: any) => {
        try {
            const attrs = buildSupplierAttrs(values)
            const contacts = normalizeContacts(values.contacts)
            const payload = {
                supplier_name: values.supplier_name,
                contact_info: contacts,
                attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
                contract_start_date: formatDateValue(values.contract_start_date),
                contract_end_date: formatDateValue(values.contract_end_date),
            }
            const created = await apiRequest<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) })
            message.success('供应商已创建，可上传合同文件')
            supplierForm.resetFields()
            setCreateModalVisible(false)
            setFileManagerSupplier(created)
            await refresh()
        } catch (err: any) {
            message.error(err.message || '创建失败')
        }
    }

    const updateSupplier = async (values: any) => {
        if (!selected) return
        try {
            const attrs = buildSupplierAttrs(values, selected)
            const contractStart = formatDateValue(values.contract_start_date)
            const contractEnd = formatDateValue(values.contract_end_date)
            const contacts = normalizeContacts(values.contacts)
            const payload = {
                supplier_name: values.supplier_name,
                contact_info: contacts,
                attrs,
                contract_start_date: contractStart,
                contract_end_date: contractEnd,
            }
            const nameChanged = selected.supplier_name !== payload.supplier_name
            const prevContacts = normalizeContacts(selected.contact_info)
            const contactChanged = JSON.stringify(prevContacts) !== JSON.stringify(contacts)
            const attrsChanged = supplierAttrKeys.some((key: SupplierAttrKey) => {
                const nextValue = normalizeAttrValue(attrs[key])
                const prevValue = normalizeAttrValue((selected.attrs as Record<string, unknown> | undefined)?.[key])
                const nextText = nextValue === undefined ? '' : String(nextValue)
                const prevText = prevValue === undefined ? '' : String(prevValue)
                return nextText !== prevText
            })
            const contractChanged =
                (selected.contract_start_date || '') !== (contractStart || '') ||
                (selected.contract_end_date || '') !== (contractEnd || '')

            if (!nameChanged && !contactChanged && !attrsChanged && !contractChanged) {
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

    const openSupplierFiles = async (supplier: Supplier | null) => {
        if (!supplier) return
        try {
            if (!supplier.folder_id) {
                const updated = await apiRequest<Supplier>(`/api/suppliers/${supplier.id}/folder`, { method: 'POST' })
                setFileManagerSupplier(updated)
                await refresh()
                return
            }
            setFileManagerSupplier(supplier)
        } catch (err: any) {
            message.error(err.message || '初始化供应商文件夹失败')
        }
    }

    const closeEditModal = () => {
        setEditModalVisible(false)
        editForm.resetFields()
        setSelected(null)
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
            title: '合同开始时间',
            dataIndex: 'contract_start_date',
            render: (v: string) => v || '-',
            sorter: (a: Supplier, b: Supplier) => (a.contract_start_date || '').localeCompare(b.contract_start_date || ''),
        },
        {
            title: '合同结束时间',
            dataIndex: 'contract_end_date',
            render: (v: string) => v || '-',
            sorter: (a: Supplier, b: Supplier) => (a.contract_end_date || '').localeCompare(b.contract_end_date || ''),
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
                                editForm.resetFields()
                                const contacts = normalizeContacts(record.contact_info)
                                editForm.setFieldsValue({
                                    supplier_name: record.supplier_name,
                                    contacts: contacts.length > 0 ? contacts : [{}],
                                    supplier_code: record.attrs?.supplier_code,
                                    business_scope: record.attrs?.business_scope,
                                    license_no: record.attrs?.license_no,
                                    legal_person: record.attrs?.legal_person,
                                    credit_code: record.attrs?.credit_code,
                                    settlement_cycle: record.attrs?.settlement_cycle,
                                    settlement_method: record.attrs?.settlement_method,
                                    invoice_info: record.attrs?.invoice_info,
                                    contract_no: record.attrs?.contract_no,
                                    contract_start_date: record.contract_start_date ? dayjs(record.contract_start_date) : undefined,
                                    contract_end_date: record.contract_end_date ? dayjs(record.contract_end_date) : undefined,
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
                                    placeholder="搜索供应商名称、联系人、电话或邮箱"
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
            <Modal
                title="新建供应商"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false)
                    supplierForm.resetFields()
                }}
                footer={null}
                centered
                width={860}
            >
                <Form layout="vertical" form={supplierForm} onFinish={createSupplier} initialValues={{ contacts: [{}] }}>
                    <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
                        <Input placeholder="例如：北京旅游集散中心" />
                    </Form.Item>
                    <div style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 12 }}>联系人信息</h4>
                        <ContactTableEditor name="contacts" addLabel="添加联系人" />
                    </div>
                    <Form.Item name="supplier_code" label="供应商编码">
                        <Input placeholder="SUP-001" />
                    </Form.Item>
                    <Form.Item name="business_scope" label="业务范围">
                        <Input.TextArea placeholder="例如：景区、酒店、交通等" rows={3} />
                    </Form.Item>
                    <Form.Item name="license_no" label="营业执照号">
                        <Input placeholder="营业执照编号" />
                    </Form.Item>
                    <Form.Item name="legal_person" label="法人信息">
                        <Input placeholder="法人姓名" />
                    </Form.Item>
                    <Form.Item name="credit_code" label="信用代码">
                        <Input placeholder="统一社会信用代码" />
                    </Form.Item>
                    <Form.Item name="settlement_cycle" label="结算周期">
                        <Input placeholder="例如：T+7" />
                    </Form.Item>
                    <Form.Item name="settlement_method" label="结算方式">
                        <Input placeholder="例如：对公转账" />
                    </Form.Item>
                    <Form.Item name="invoice_info" label="发票信息">
                        <Input.TextArea placeholder="发票抬头、税号等" rows={3} />
                    </Form.Item>
                    <Form.Item name="contract_no" label="合同编号">
                        <Input placeholder="合同编号" />
                    </Form.Item>
                    <Form.Item name="contract_start_date" label="合同开始时间">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="contract_end_date" label="合同结束时间">
                        <DatePicker style={{ width: '100%' }} />
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
            </Modal>

            {/* 编辑供应商Modal */}
            <Modal
                title={`编辑供应商: ${selected?.supplier_name} `}
                open={editModalVisible}
                onCancel={closeEditModal}
                footer={(
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button
                            icon={<FolderOpenOutlined />}
                            onClick={() => openSupplierFiles(selected)}
                            disabled={!selected}
                        >
                            文件管理
                        </Button>
                        <Space>
                            <Button onClick={closeEditModal}>取消</Button>
                            <Button type="primary" onClick={() => editForm.submit()}>
                                保存
                            </Button>
                        </Space>
                    </div>
                )}
                centered
                width={860}
            >
                <Form layout="vertical" form={editForm} onFinish={updateSupplier}>
                    <Form.Item name="supplier_name" label="供应商名称" rules={[{ required: true, message: '请输入供应商名称' }]}>
                        <Input />
                    </Form.Item>
                    <div style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 12 }}>联系人信息</h4>
                        <ContactTableEditor name="contacts" addLabel="添加联系人" />
                    </div>
                    <Form.Item name="supplier_code" label="供应商编码">
                        <Input />
                    </Form.Item>
                    <Form.Item name="business_scope" label="业务范围">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item name="license_no" label="营业执照号">
                        <Input />
                    </Form.Item>
                    <Form.Item name="legal_person" label="法人信息">
                        <Input />
                    </Form.Item>
                    <Form.Item name="credit_code" label="信用代码">
                        <Input />
                    </Form.Item>
                    <Form.Item name="settlement_cycle" label="结算周期">
                        <Input />
                    </Form.Item>
                    <Form.Item name="settlement_method" label="结算方式">
                        <Input />
                    </Form.Item>
                    <Form.Item name="invoice_info" label="发票信息">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item name="contract_no" label="合同编号">
                        <Input />
                    </Form.Item>
                    <Form.Item name="contract_start_date" label="合同开始时间">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="contract_end_date" label="合同结束时间">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>

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
                            <Descriptions.Item label="联系人信息" span={2}>
                                {(() => {
                                    const contacts = normalizeContacts(selected.contact_info)
                                    if (contacts.length === 0) return '-'
                                    return (
                                        <Table
                                            size="small"
                                            pagination={false}
                                            rowKey={(_, index) => String(index)}
                                            dataSource={contacts}
                                            columns={[
                                                { title: '联系人', dataIndex: 'name' },
                                                { title: '电话', dataIndex: 'phone' },
                                                { title: '邮箱', dataIndex: 'email' },
                                                { title: '职位', dataIndex: 'position' },
                                            ]}
                                        />
                                    )
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="供应商编码">{formatAttrDisplay(selected.attrs?.supplier_code)}</Descriptions.Item>
                            <Descriptions.Item label="营业执照号">{formatAttrDisplay(selected.attrs?.license_no)}</Descriptions.Item>
                            <Descriptions.Item label="法人信息">{formatAttrDisplay(selected.attrs?.legal_person)}</Descriptions.Item>
                            <Descriptions.Item label="信用代码">{formatAttrDisplay(selected.attrs?.credit_code)}</Descriptions.Item>
                            <Descriptions.Item label="结算周期">{formatAttrDisplay(selected.attrs?.settlement_cycle)}</Descriptions.Item>
                            <Descriptions.Item label="结算方式">{formatAttrDisplay(selected.attrs?.settlement_method)}</Descriptions.Item>
                            <Descriptions.Item label="合同编号">{formatAttrDisplay(selected.attrs?.contract_no)}</Descriptions.Item>
                            <Descriptions.Item label="合同开始时间">{selected.contract_start_date || '-'}</Descriptions.Item>
                            <Descriptions.Item label="合同结束时间">{selected.contract_end_date || '-'}</Descriptions.Item>
                            <Descriptions.Item label="业务范围" span={2}>{formatAttrDisplay(selected.attrs?.business_scope)}</Descriptions.Item>
                            <Descriptions.Item label="发票信息" span={2}>{formatAttrDisplay(selected.attrs?.invoice_info)}</Descriptions.Item>
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

            <SupplierFileModal
                supplier={fileManagerSupplier}
                open={!!fileManagerSupplier}
                onClose={() => setFileManagerSupplier(null)}
            />
        </div>
    )
}
