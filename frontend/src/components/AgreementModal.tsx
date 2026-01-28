import { useState, useEffect } from 'react'
import { Modal, Table, Button, Space, Form, Input, DatePicker, Select, Switch, Checkbox, InputNumber, message, Tag, Row, Col } from 'antd'
import { PlusOutlined, PaperClipOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { apiRequest } from '@/lib/api'
import POIFileManager from './POIFileManager'

// Define types based on backend schema
interface Agreement {
    id: number
    supplier_resource_id: number
    agreement_name: string
    start_date: string
    end_date: string
    signing_date?: string
    status: string
    settlement_cycle?: string
    payment_method?: string
    requires_invoice: boolean
    invoice_type?: string
    discount_methods?: Record<string, boolean>
    discount_policy?: Record<string, number>
    attached_files?: Array<{ id: number, filename: string, url: string }>
}

interface AgreementModalProps {
    visible: boolean
    onCancel: () => void
    supplierResourceId: number
    supplierName: string
    supplierFolderId: number | null
}

export default function AgreementModal({ visible, onCancel, supplierResourceId, supplierName, supplierFolderId }: AgreementModalProps) {
    const [agreements, setAgreements] = useState<Agreement[]>([])
    const [loading, setLoading] = useState(false)

    // Editor State
    const [editorVisible, setEditorVisible] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form] = Form.useForm()

    // File Selector State
    const [fileSelectorVisible, setFileSelectorVisible] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<Array<any>>([])

    // Load Agreements
    const loadAgreements = async () => {
        if (!supplierResourceId) return
        setLoading(true)
        try {
            const res = await apiRequest<Agreement[]>(`/api/supplier-resource-agreements?supplier_resource_id=${supplierResourceId}`)
            setAgreements(res || [])
        } catch (err: any) {
            message.error(err.message || '加载协议失败')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (visible && supplierResourceId) {
            loadAgreements()
        }
    }, [visible, supplierResourceId])

    // Handle Edit/Create
    const handleEdit = (record?: Agreement) => {
        form.resetFields()
        setSelectedFiles([])

        if (record) {
            setEditingId(record.id)
            form.setFieldsValue({
                ...record,
                start_date: dayjs(record.start_date),
                end_date: dayjs(record.end_date),
                signing_date: record.signing_date ? dayjs(record.signing_date) : undefined,
                discount_methods_keys: Object.keys(record.discount_methods || {}).filter(k => record.discount_methods?.[k]),
                x: record.discount_policy?.x,
                y: record.discount_policy?.y,
                a: record.discount_policy?.a,
                b: record.discount_policy?.b,
            })
            setSelectedFiles(record.attached_files || [])
        } else {
            setEditingId(null)
            form.setFieldsValue({
                status: 'active',
                requires_invoice: false
            })
        }
        setEditorVisible(true)
    }

    const handleDelete = async (id: number) => {
        try {
            await apiRequest(`/api/supplier-resource-agreements/${id}`, { method: 'DELETE' })
            message.success('删除成功')
            loadAgreements()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const handleSave = async () => {
        try {
            const values = await form.validateFields()

            // Transform Data
            const payload: any = {
                supplier_resource_id: supplierResourceId,
                agreement_name: values.agreement_name,
                start_date: values.start_date.format('YYYY-MM-DD'),
                end_date: values.end_date.format('YYYY-MM-DD'),
                signing_date: values.signing_date?.format('YYYY-MM-DD'),
                status: values.status,
                settlement_cycle: values.settlement_cycle,
                payment_method: values.payment_method,
                requires_invoice: values.requires_invoice,
                invoice_type: values.invoice_type,
                attached_files: selectedFiles.map(f => ({ id: f.id, filename: f.filename, url: f.url })),
                discount_methods: {},
                discount_policy: {
                    x: values.x,
                    y: values.y,
                    a: values.a,
                    b: values.b
                }
            }

            // Handle checkbox group for discount methods
            if (values.discount_methods_keys) {
                values.discount_methods_keys.forEach((k: string) => {
                    payload.discount_methods[k] = true
                })
            }

            if (editingId) {
                await apiRequest(`/api/supplier-resource-agreements/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                })
                message.success('更新成功')
            } else {
                await apiRequest('/api/supplier-resource-agreements', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                })
                message.success('创建成功')
            }

            setEditorVisible(false)
            loadAgreements()
        } catch (err: any) {
            console.error(err)
            message.error(err.message || '保存失败')
        }
    }

    const columns = [
        { title: '协议名称', dataIndex: 'agreement_name' },
        {
            title: '有效期',
            render: (_: any, r: Agreement) => `${r.start_date} 至 ${r.end_date}`
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => <Tag color={v === 'active' ? 'green' : 'red'}>{v === 'active' ? '启用' : '停用'}</Tag>
        },
        {
            title: '操作',
            render: (_: any, r: Agreement) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleEdit(r)}>编辑</Button>
                    <Button type="link" danger size="small" onClick={() => handleDelete(r.id)}>删除</Button>
                </Space>
            )
        }
    ]

    return (
        <>
            <Modal
                title={`协议管理 - ${supplierName}`}
                open={visible}
                onCancel={onCancel}
                width={1000}
                footer={null}
                destroyOnClose
            >
                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEdit()}>
                        新增协议
                    </Button>
                </div>

                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns}
                    dataSource={agreements}
                    pagination={false}
                />
            </Modal>

            {/* Editor Modal */}
            <Modal
                title={editingId ? '编辑协议' : '新建协议'}
                open={editorVisible}
                onCancel={() => setEditorVisible(false)}
                onOk={handleSave}
                width={800}
                destroyOnClose
            >
                <Form layout="vertical" form={form}>
                    <Form.Item name="agreement_name" label="协议名称" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="start_date" label="有效期开始" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="end_date" label="有效期结束" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="signing_date" label="签署日期">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="status" label="协议状态" rules={[{ required: true }]}>
                                <Select>
                                    <Select.Option value="active">启用</Select.Option>
                                    <Select.Option value="inactive">停用</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item label="相关附件">
                        <div style={{ marginBottom: 8 }}>
                            <Button icon={<PaperClipOutlined />} onClick={() => setFileSelectorVisible(true)}>
                                选择附件
                            </Button>
                        </div>
                        {selectedFiles.length > 0 && (
                            <Table
                                rowKey="id"
                                size="small"
                                dataSource={selectedFiles}
                                columns={[
                                    { title: '文件名称', dataIndex: 'filename' },
                                    {
                                        title: '操作', render: (_, r) => (
                                            <a onClick={() => setSelectedFiles(prev => prev.filter(f => f.id !== r.id))}>删除</a>
                                        )
                                    }
                                ]}
                                pagination={false}
                            />
                        )}
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="settlement_cycle" label="结算周期">
                                <Input placeholder="例如：月结/单结" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="payment_method" label="付款方式">
                                <Input placeholder="例如：对公转账" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="requires_invoice" valuePropName="checked" label="是否需要发票">
                        <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) => prev.requires_invoice !== curr.requires_invoice}
                    >
                        {({ getFieldValue }) =>
                            getFieldValue('requires_invoice') ? (
                                <Form.Item name="invoice_type" label="发票类型">
                                    <Input placeholder="例如：增值税专用发票" />
                                </Form.Item>
                            ) : null
                        }
                    </Form.Item>

                    <Form.Item name="discount_methods_keys" label="优惠方式">
                        <Checkbox.Group>
                            <Checkbox value="amount_off">满减 (满x减y)</Checkbox>
                            <Checkbox value="gift">满送 (满a送b)</Checkbox>
                        </Checkbox.Group>
                    </Form.Item>

                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, curr) => prev.discount_methods_keys !== curr.discount_methods_keys}
                    >
                        {({ getFieldValue }) => {
                            const methods = getFieldValue('discount_methods_keys') || []
                            return (
                                <Space align="baseline" style={{ display: 'flex', flexWrap: 'wrap' }}>
                                    {methods.includes('amount_off') && (
                                        <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 4 }}>
                                            <span>满</span>
                                            <Form.Item name="x" noStyle><InputNumber style={{ width: 80 }} /></Form.Item>
                                            <span> 减</span>
                                            <Form.Item name="y" noStyle><InputNumber style={{ width: 80 }} /></Form.Item>
                                        </div>
                                    )}
                                    {methods.includes('gift') && (
                                        <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 4 }}>
                                            <span>满</span>
                                            <Form.Item name="a" noStyle><InputNumber style={{ width: 80 }} /></Form.Item>
                                            <span> 送</span>
                                            <Form.Item name="b" noStyle><InputNumber style={{ width: 80 }} /></Form.Item>
                                        </div>
                                    )}
                                </Space>
                            )
                        }}
                    </Form.Item>
                </Form>
            </Modal>

            {/* File Selector Modal */}
            <Modal
                title="选择附件"
                open={fileSelectorVisible}
                onCancel={() => setFileSelectorVisible(false)}
                width={900}
                onOk={() => setFileSelectorVisible(false)}
            >
                <div style={{ height: 500, overflow: 'auto' }}>
                    <POIFileManager
                        poiFolderId={supplierFolderId}
                        entityLabel="供应商"
                        mode="select"
                        defaultSelectedFiles={selectedFiles as any[]}
                        onSelectionChange={(files) => {
                            setSelectedFiles(files)
                        }}
                    />
                </div>
            </Modal>
        </>
    )
}
