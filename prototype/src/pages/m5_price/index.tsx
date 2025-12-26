import { useMemo, useState } from 'react'
import { Button, Card, DatePicker, Form, InputNumber, Modal, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import { usePricesStore } from '../../store/prices'
import { useMockDataContext } from '../../app/MockDataProvider'
import { useApprovalsStore } from '../../store/approvals'
import { useAuditLogStore } from '../../store/auditLog'
import type { Price } from '../../types'

export default function PriceCenterPage() {
  const { data } = useMockDataContext()
  const { prices, priceHistory, checkConflict, cloneActiveToDraft, upsertPrice } = usePricesStore()
  const { submit } = useApprovalsStore()
  const { addLog } = useAuditLogStore()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState<Price | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const skus = data?.skus ?? []
  const channels = data?.channels ?? []

  const tableData = useMemo(
    () =>
      prices.map((p) => ({
        ...p,
        sku_name: skus.find((s) => s.id === p.sku_id)?.sku_name,
        channel_name: channels.find((c) => c.id === p.channel_id)?.channel_name,
      })),
    [channels, prices, skus],
  )

  const openModal = (record?: Price) => {
    const draft = record ? cloneActiveToDraft(record.sku_id, record.channel_id) ?? record : null
    setEditing(draft ?? record ?? null)
    form.setFieldsValue({
      sku_id: draft?.sku_id ?? record?.sku_id,
      channel_id: draft?.channel_id ?? record?.channel_id,
      sale_price: draft?.sale_price ?? record?.sale_price,
      cost_price: draft?.cost_price ?? record?.cost_price,
      range: draft ? [dayjs(draft.start_at), dayjs(draft.end_at)] : undefined,
    })
    setModalOpen(true)
  }

  const submitPrice = (values: any) => {
    const [start, end] = values.range
    const conflict = checkConflict(values.sku_id, values.channel_id, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), editing?.id)
    if (conflict.length) {
      message.error(`时间冲突：与 ${conflict[0].start_at}~${conflict[0].end_at} 重叠`)
      return
    }
    const price: Price = {
      id: editing?.id ?? nanoid(8),
      sku_id: values.sku_id,
      channel_id: values.channel_id,
      sale_price: values.sale_price,
      cost_price: values.cost_price ?? null,
      start_at: start.format('YYYY-MM-DD'),
      end_at: end.format('YYYY-MM-DD'),
      status: '待审批',
      created_by: 'pm.zhang',
    }
    upsertPrice(price)
    const approval = submit({
      object_type: 'price',
      object_id: price.id,
      action_type: '调价',
      before_data: editing,
      after_data: price,
      applicant: 'pm.zhang',
      approver: '主管',
    })
    addLog({
      table_name: 'price',
      record_id: price.id,
      operation: 'INSERT',
      diff_data: { after: price },
      source: '调价弹窗',
    })
    message.success(`已生成调价草稿，审批单 ${approval.id}`)
    setEditing(null)
    setModalOpen(false)
    form.resetFields()
  }

  const columns: ColumnsType<Price & { sku_name?: string; channel_name?: string }> = [
    { title: 'SKU', dataIndex: 'sku_name' },
    { title: '渠道', dataIndex: 'channel_name' },
    { title: '价格区间', render: (_, record) => `${record.start_at} ~ ${record.end_at}` },
    { title: '售价', dataIndex: 'sale_price' },
    { title: '成本价', dataIndex: 'cost_price' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openModal(record)}>
            调价
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        title="M5 定价中心"
        subtitle="调价=复制生效版生成草稿，时间冲突前端阻断"
        actions={[
          <Button key="new" type="primary" onClick={() => openModal()}>
            新建价格
          </Button>,
        ]}
      />
      <Table rowKey="id" dataSource={tableData} columns={columns} />

      <Card title="价格历史" size="small" style={{ marginTop: 12 }}>
        <Table
          size="small"
          rowKey="id"
          dataSource={priceHistory}
          pagination={false}
          columns={[
            { title: 'price_id', dataIndex: 'price_id' },
            { title: '前', dataIndex: ['before_data', 'sale_price'], render: (_, record) => (record.before_data as any)?.sale_price },
            { title: '后', dataIndex: ['after_data', 'sale_price'], render: (_, record) => (record.after_data as any)?.sale_price },
            { title: '时间', dataIndex: 'operated_at' },
          ]}
        />
      </Card>

      <Modal title="调价" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={submitPrice}>
          <Form.Item name="sku_id" label="SKU" rules={[{ required: true }]}>
            <Select options={skus.map((s) => ({ value: s.id, label: s.sku_name }))} />
          </Form.Item>
          <Form.Item name="channel_id" label="渠道" rules={[{ required: true }]}>
            <Select options={channels.map((c) => ({ value: c.id, label: c.channel_name }))} />
          </Form.Item>
          <Form.Item name="sale_price" label="售价" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cost_price" label="成本价">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="range" label="生效区间" rules={[{ required: true }]}>
            <DatePicker.RangePicker />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
