import { useState, useEffect } from 'react'
import { Modal, Table, Button, Space, Form, Input, DatePicker, Select, Switch, Checkbox, InputNumber, message, Row, Col } from 'antd'
import { PlusOutlined, PaperClipOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import POIFileManager from './POIFileManager'

interface AgreementPreset {
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

interface PresetAgreementEditorProps {
    visible: boolean
    onCancel: () => void
    onSave: (agreements: AgreementPreset[]) => void
    supplierName: string
    supplierFolderId: number | null
    initialAgreements?: AgreementPreset[]
}

export default function PresetAgreementEditor({
    visible,
    onCancel,
    onSave,
    supplierName,
    supplierFolderId,
    initialAgreements = []
}: PresetAgreementEditorProps) {
    const [agreements, setAgreements] = useState<AgreementPreset[]>(initialAgreements)
    const [editorVisible, setEditorVisible] = useState(false)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)
    const [form] = Form.useForm()

    // File Selector State
    const [fileSelectorVisible, setFileSelectorVisible] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<Array<any>>([])

    useEffect(() => {
        if (visible) {
            setAgreements(initialAgreements)
        }
    }, [visible, initialAgreements])

    const handleEdit = (index?: number) => {
        form.resetFields()
        setSelectedFiles([])

        if (index !== undefined) {
            const agreement = agreements[index]
            setEditingIndex(index)
            form.setFieldsValue({
                ...agreement,
                start_date: dayjs(agreement.start_date),
                end_date: dayjs(agreement.end_date),
                signing_date: agreement.signing_date ? dayjs(agreement.signing_date) : undefined,
                discount_methods_keys: Object.keys(agreement.discount_methods || {}).filter(k => agreement.discount_methods?.[k]),
                x: agreement.discount_policy?.x,
                y: agreement.discount_policy?.y,
                a: agreement.discount_policy?.a,
                b: agreement.discount_policy?.b,
            })
            setSelectedFiles(agreement.attached_files || [])
        } else {
            setEditingIndex(null)
            form.setFieldsValue({
                status: 'active',
                requires_invoice: false
            })
        }
        setEditorVisible(true)
    }

    const handleDelete = (index: number) => {
        setAgreements(prev => prev.filter((_, i) => i !== index))
        message.success('已删除')
    }

    const handleSaveAgreement = async () => {
        try {
            const values = await form.validateFields()

            const agreement: AgreementPreset = {
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

            if (values.discount_methods_keys) {
                values.discount_methods_keys.forEach((k: string) => {
                    agreement.discount_methods![k] = true
                })
            }

            if (editingIndex !== null) {
                setAgreements(prev => prev.map((a, i) => i === editingIndex ? agreement : a))
                message.success('已更新')
            } else {
                setAgreements(prev => [...prev, agreement])
                message.success('已添加')
            }

            setEditorVisible(false)
        } catch (err: any) {
            console.error(err)
        }
    }

    const handleConfirm = () => {
        onSave(agreements)
        onCancel()
    }

    const columns = [
        { title: '协议名称', dataIndex: 'agreement_name' },
        {
            title: '有效期',
            render: (_: any, r: AgreementPreset) => `${r.start_date} 至 ${r.end_date}`
        },
        {
            title: '操作',
            render: (_: any, _r: AgreementPreset, index: number) => (
                <Space>
                    <Button type="link" size="small" onClick={() => handleEdit(index)}>编辑</Button>
                    <Button type="link" danger size="small" onClick={() => handleDelete(index)}>删除</Button>
                </Space>
            )
        }
    ]

    return (
        <>
            <Modal
                title={`预设协议 - ${supplierName}`}
                open={visible}
                onCancel={onCancel}
                onOk={handleConfirm}
                width={800}
                destroyOnClose
            >
                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => handleEdit()}>
                        添加协议
                    </Button>
                </div>

                <Table
                    rowKey={(_, index) => index!}
                    columns={columns}
                    dataSource={agreements}
                    pagination={false}
                />

                <div style={{ marginTop: 12, color: '#666', fontSize: 12 }}>
                    提示：这些协议会在子资源创建成功后自动关联到该供应商绑定。
                </div>
            </Modal>

            {/* Editor Modal */}
            <Modal
                title={editingIndex !== null ? '编辑协议' : '新建协议'}
                open={editorVisible}
                onCancel={() => setEditorVisible(false)}
                onOk={handleSaveAgreement}
                width={700}
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
