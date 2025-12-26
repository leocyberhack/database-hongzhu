import { useState } from 'react'
import { Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import ImportModal from '../../components/ImportModal'
import { useOrdersStore } from '../../store/orders'
import { useMockDataContext } from '../../app/MockDataProvider'
import { useInventoryStore } from '../../store/inventory'
import { usePricesStore } from '../../store/prices'
import { useAuditLogStore } from '../../store/auditLog'
import type { Order } from '../../types'

export default function OrdersPage() {
  const { data } = useMockDataContext()
  const { orders, createOrder, verifyOrder, refundOrder } = useOrdersStore()
  const { freeze, consume, release } = useInventoryStore()
  const { prices } = usePricesStore()
  const { addLog } = useAuditLogStore()
  const [form] = Form.useForm()
  const [importOpen, setImportOpen] = useState(false)
  const channels = data?.channels ?? []
  const skus = data?.skus ?? []

  const columns: ColumnsType<Order> = [
    { title: '订单号', dataIndex: 'order_no' },
    { title: '渠道', dataIndex: 'channel_id' },
    { title: 'SKU', dataIndex: 'sku_id' },
    { title: '出行日期', dataIndex: 'travel_date' },
    { title: 'GMV', dataIndex: 'sale_amount' },
    { title: '成本', dataIndex: 'cost_amount' },
    { title: '利润', dataIndex: 'profit_amount' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    {
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button size="small" type="link" disabled={record.status !== '已支付'} onClick={() => handleVerify(record)}>
            核销
          </Button>
          <Button size="small" type="link" disabled={record.status !== '已支付'} onClick={() => handleRefund(record)}>
            退款
          </Button>
        </Space>
      ),
    },
  ]

  const handleVerify = (order: Order) => {
    Modal.confirm({
      title: '确认核销此订单？',
      content: `订单 ${order.order_no} 将扣减冻结库存并标记为已核销。`,
      onOk: () => {
        const inv = consume(order.sku_id, order.travel_date, order.quantity, order.id, '客服')
        if (!inv.ok) {
          message.error(inv.message)
          return
        }
        verifyOrder(order.id, '客服')
        addLog({ table_name: 'order', record_id: order.id, operation: 'STATUS_CHANGE', diff_data: { status: '已核销' }, source: '核销' })
        message.success('已核销，库存扣减')
      },
    })
  }

  const handleRefund = (order: Order) => {
    Modal.confirm({
      title: '确认退款此订单？',
      content: `订单 ${order.order_no} 将解冻库存并标记为已退款。`,
      onOk: () => {
        const inv = release(order.sku_id, order.travel_date, order.quantity, order.id, '客服')
        if (!inv.ok) {
          message.error(inv.message)
          return
        }
        refundOrder(order.id, '客服')
        addLog({ table_name: 'order', record_id: order.id, operation: 'STATUS_CHANGE', diff_data: { status: '已退款' }, source: '退款' })
        message.success('已退款，库存解冻')
      },
    })
  }

  const getActivePrice = (skuId: string, channelId: string, travelDate: string) => {
    return prices.find((p) => {
      if (p.sku_id !== skuId || p.channel_id !== channelId || p.status !== '生效') return false
      const travel = dayjs(travelDate)
      return !travel.isBefore(dayjs(p.start_at)) && !travel.isAfter(dayjs(p.end_at))
    })
  }

  const submitOrder = (values: any) => {
    const travelDate = values.travel_date.format('YYYY-MM-DD')
    const price = getActivePrice(values.sku_id, values.channel_id, travelDate)
    const salePrice = values.sale_price ?? price?.sale_price
    const costPrice = values.cost_price ?? price?.cost_price ?? null
    if (!salePrice) {
      message.error('缺生效价格')
      return
    }
    const orderId = nanoid(8)
    const freezeResult = freeze(values.sku_id, travelDate, values.quantity, orderId, '客服')
    if (!freezeResult.ok) {
      message.error(freezeResult.message)
      return
    }
    const order = createOrder({
      id: orderId,
      order_no: values.order_no ?? `ON${nanoid(6)}`,
      channel_id: values.channel_id,
      sku_id: values.sku_id,
      product_id: skus.find((s) => s.id === values.sku_id)?.product_id ?? '',
      travel_date: travelDate,
      quantity: values.quantity,
      sale_price: salePrice,
      cost_price: costPrice,
      remark: values.remark,
    })
    addLog({ table_name: 'order', record_id: order.id, operation: 'INSERT', diff_data: order, source: '新建订单' })
    message.success('订单已创建并冻结库存')
    form.resetFields()
  }

  const importOrders = (rows: Record<string, string>[]) => {
    const mapped: Order[] = rows.map((row) => ({
      id: nanoid(8),
      order_no: row.order_no ?? row['订单号'] ?? `IM${nanoid(5)}`,
      channel_id: row.channel_id ?? row['渠道'] ?? channels[0]?.id ?? '',
      sku_id: row.sku_id ?? row['SKU'] ?? skus[0]?.id ?? '',
      product_id: skus.find((s) => s.id === row.sku_id)?.product_id ?? '',
      travel_date: row.travel_date ?? dayjs().format('YYYY-MM-DD'),
      quantity: Number(row.quantity ?? 1),
      sale_price: Number(row.sale_price ?? 0),
      sale_amount: Number(row.sale_price ?? 0) * Number(row.quantity ?? 1),
      cost_price: row.cost_price ? Number(row.cost_price) : null,
      cost_amount: row.cost_price ? Number(row.cost_price) * Number(row.quantity ?? 1) : null,
      profit_amount: row.cost_price ? Number(row.sale_price ?? 0) * Number(row.quantity ?? 1) - Number(row.cost_price) * Number(row.quantity ?? 1) : null,
      status: '已支付',
      created_by: '导入',
      created_at: dayjs().toISOString(),
    }))
    const result = useOrdersStore.getState().importOrders(mapped)
    message.success(`导入完成，新增 ${result.added}，跳过 ${result.skipped}`)
  }

  return (
    <div className="page">
      <PageHeader
        title="M7 订单"
        subtitle="新建/导入订单自动冻结库存，核销=冻结-1 & 已售+1；订单价格写死"
        actions={[
          <Button key="import" onClick={() => setImportOpen(true)}>
            导入订单
          </Button>,
        ]}
      />
      <Space align="start" size={12} style={{ width: '100%' }}>
        <Card style={{ flex: 1 }} title="订单列表">
          <Table<Order> rowKey="id" dataSource={orders} columns={columns} pagination={{ pageSize: 8 }} />
        </Card>
        <Card title="新建订单" style={{ width: 360 }}>
          <Form layout="vertical" form={form} onFinish={submitOrder} initialValues={{ quantity: 1, travel_date: dayjs() }}>
            <Form.Item name="channel_id" label="渠道" rules={[{ required: true }]}>
              <Select options={channels.map((c) => ({ value: c.id, label: c.channel_name }))} />
            </Form.Item>
            <Form.Item name="sku_id" label="SKU" rules={[{ required: true }]}>
              <Select options={skus.map((s) => ({ value: s.id, label: s.sku_name }))} />
            </Form.Item>
            <Form.Item name="travel_date" label="出行日期" rules={[{ required: true }]}>
              <DatePicker />
            </Form.Item>
            <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="sale_price" label="售价（可自动带出）">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cost_price" label="成本价（可为空，标记异常）">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建并冻结库存
            </Button>
          </Form>
        </Card>
      </Space>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={importOrders} templateNote="列示例：order_no,channel_id,sku_id,travel_date,quantity,sale_price,cost_price" />
      <Card size="small" style={{ marginTop: 12 }} title="导入规则 / 重复处理">
        <Tag color="blue">重复 order_no+channel_id 自动跳过</Tag> <Tag color="orange">缺库存无法自动处理，建议先初始化</Tag> <Tag color="red">成本缺失订单标记异常</Tag>
      </Card>
    </div>
  )
}
