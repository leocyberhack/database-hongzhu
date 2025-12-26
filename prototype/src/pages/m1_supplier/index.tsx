import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { nanoid } from 'nanoid'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import { useMockDataContext } from '../../app/MockDataProvider'
import type { Supplier, SupplierResource, SupplierResourcePriceHistory } from '../../types'
import { useApprovalsStore } from '../../store/approvals'

const SUPPLIER_TYPES = ['景区', '酒店', '交通', '餐饮', '地接', '票务']

export default function SupplierPage() {
  const { data, updateData } = useMockDataContext()
  const { submit } = useApprovalsStore()
  const [supplierForm] = Form.useForm()
  const [supplyForm] = Form.useForm()
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [adjustVisible, setAdjustVisible] = useState(false)
  const [adjustRecord, setAdjustRecord] = useState<SupplierResource | null>(null)
  const [detailAutoOpened, setDetailAutoOpened] = useState(false)
  const suppliers = data?.suppliers ?? []
  const resources = data?.resources ?? []
  const supplierResources = data?.supplier_resources ?? []
  const priceHistory = data?.supplier_resource_price_history ?? []
  const [searchParams] = useSearchParams()

  const columns: ColumnsType<Supplier> = [
    { title: '供应商', dataIndex: 'supplier_name' },
    { title: '类型', dataIndex: 'supplier_type' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags?: string[]) => tags?.map((t) => <Tag key={t}>{t}</Tag>),
    },
  ]

  const supplyList = useMemo(
    () =>
      supplierResources
        .filter((sr) => sr.supplier_id === selected?.id)
        .map((sr) => ({ ...sr, resource: resources.find((r) => r.id === sr.resource_id) })),
    [resources, selected?.id, supplierResources],
  )

  useEffect(() => {
    if (searchParams.get('detail') && !detailAutoOpened && suppliers.length) {
      setSelected(suppliers[0])
      setDetailAutoOpened(true)
    }
  }, [searchParams, suppliers, detailAutoOpened])

  const createSupplier = (values: any) => {
    const newSupplier: Supplier = {
      ...values,
      id: nanoid(8),
      status: '合作中',
      tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()) : [],
    }
    updateData('suppliers', [newSupplier, ...suppliers])
    message.success('供应商已创建')
    supplierForm.resetFields()
  }

  const bindResource = (values: any) => {
    const exists = supplierResources.find((sr) => sr.supplier_id === values.supplier_id && sr.resource_id === values.resource_id)
    if (exists) {
      message.error('该资源已绑定，请直接调价')
      return
    }
    const record: SupplierResource = {
      ...values,
      id: nanoid(8),
      currency: 'CNY',
      supply_status: '可供',
    }
    updateData('supplier_resources', [record, ...supplierResources])
    message.success('供给关系已创建')
    supplyForm.resetFields()
  }

  const openAdjust = (record: SupplierResource) => {
    setAdjustRecord(record)
    setAdjustVisible(true)
  }

  const handleAdjust = (values: any) => {
    if (!adjustRecord) return
    const newPrice = values.settlement_price
    const newHistory: SupplierResourcePriceHistory = {
      id: nanoid(8),
      supplier_resource_id: adjustRecord.id,
      before_price: adjustRecord.settlement_price,
      after_price: newPrice,
      reason: values.reason,
      operator: 'pm.zhang',
      operated_at: new Date().toISOString(),
    }
    updateData(
      'supplier_resources',
      supplierResources.map((sr) => (sr.id === adjustRecord.id ? { ...sr, settlement_price: newPrice } : sr)),
    )
    updateData('supplier_resource_price_history', [newHistory, ...(priceHistory ?? [])])
    submit({
      object_type: 'supplier',
      object_id: adjustRecord.id,
      action_type: '结算价变更',
      before_data: adjustRecord,
      after_data: { ...adjustRecord, settlement_price: newPrice },
      applicant: 'pm.zhang',
      approver: '主管',
    })
    message.success('已提交调价，进入待审批')
    setAdjustVisible(false)
  }

  return (
    <div className="page">
      <PageHeader title="M1 供应商" subtitle="供给关系 + 结算价历史，调价走审批" />
      <Space align="start" size={12} style={{ width: '100%' }}>
        <Card style={{ flex: 1 }} title="供应商列表">
          <Table<Supplier>
            rowKey="id"
            columns={columns}
            dataSource={suppliers}
            onRow={(record) => ({
              onClick: () => setSelected(record),
            })}
          />
        </Card>
        <div style={{ width: 360 }}>
          <Card title="新建供应商" style={{ marginBottom: 12 }}>
            <Form layout="vertical" form={supplierForm} onFinish={createSupplier}>
              <Form.Item name="supplier_name" label="名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="supplier_type" label="类型" rules={[{ required: true }]}>
                <Select options={SUPPLIER_TYPES.map((t) => ({ value: t, label: t }))} />
              </Form.Item>
              <Form.Item name="contact_info" label="联系人">
                <Input placeholder="张三 138****" />
              </Form.Item>
              <Form.Item name="tags" label="标签（逗号分隔）">
                <Input />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                保存
              </Button>
            </Form>
          </Card>

          <Card title="绑定资源">
            <Form layout="vertical" form={supplyForm} onFinish={bindResource} initialValues={{ supplier_id: selected?.id }}>
              <Form.Item name="supplier_id" label="供应商" rules={[{ required: true }]}>
                <Select options={suppliers.map((s) => ({ value: s.id, label: s.supplier_name }))} />
              </Form.Item>
              <Form.Item name="resource_id" label="资源" rules={[{ required: true }]}>
                <Select
                  showSearch
                  options={resources.map((r) => ({ value: r.id, label: `${r.resource_name} (${r.resource_type})` }))}
                />
              </Form.Item>
              <Form.Item name="settlement_price" label="结算价" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                绑定并生效
              </Button>
            </Form>
          </Card>
        </div>
      </Space>

      <Drawer
        title={selected?.supplier_name}
        open={!!selected}
        width={720}
        onClose={() => setSelected(null)}
        extra={<StatusTag status={selected?.status ?? ''} />}
      >
        {selected && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
              <Descriptions.Item label="类型">{selected.supplier_type}</Descriptions.Item>
              <Descriptions.Item label="联系人">{(selected.contact_info as any)?.contact ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <StatusTag status={selected.status} />
              </Descriptions.Item>
              <Descriptions.Item label="标签">{selected.tags?.join(',') ?? '-'}</Descriptions.Item>
            </Descriptions>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={supplyList}
              columns={[
                { title: '资源', dataIndex: ['resource', 'resource_name'] },
                { title: '结算价', dataIndex: 'settlement_price' },
                { title: '供给状态', dataIndex: 'supply_status', render: (v: string) => <StatusTag status={v} /> },
                {
                  title: '操作',
                  render: (_, record) => (
                    <Button type="link" size="small" onClick={() => openAdjust(record)}>
                      调价
                    </Button>
                  ),
                },
              ]}
            />
            <Card title="结算价历史" size="small" style={{ marginTop: 12 }}>
              <Table
                rowKey="id"
                size="small"
                dataSource={priceHistory.filter((h) => supplyList.some((s) => s.id === h.supplier_resource_id))}
                pagination={false}
                columns={[
                  { title: '变更前', dataIndex: 'before_price' },
                  { title: '变更后', dataIndex: 'after_price' },
                  { title: '原因', dataIndex: 'reason' },
                  { title: '时间', dataIndex: 'operated_at' },
                ]}
              />
            </Card>
          </>
        )}
      </Drawer>

      <Modal title="调价（写入历史并走审批）" open={adjustVisible} onCancel={() => setAdjustVisible(false)} footer={null}>
        <Form layout="vertical" onFinish={handleAdjust}>
          <Form.Item label="新结算价" name="settlement_price" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="原因" name="reason">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            提交调价（待审批）
          </Button>
        </Form>
      </Modal>
    </div>
  )
}
