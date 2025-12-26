import { useState } from 'react'
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import { useInventoryStore } from '../../store/inventory'
import { useMockDataContext } from '../../app/MockDataProvider'
import { dateRange } from '../../utils/date'
import { useAuditLogStore } from '../../store/auditLog'

const { RangePicker } = DatePicker

export default function InventoryPage() {
  const { data } = useMockDataContext()
  const { inventory, inventoryLog, initInventory, adjust } = useInventoryStore()
  const { addLog } = useAuditLogStore()
  const [form] = Form.useForm()
  const [adjustForm] = Form.useForm()
  const [skuId, setSkuId] = useState<string | undefined>()
  const skus = data?.skus ?? []

  const filtered = skuId ? inventory.filter((inv) => inv.sku_id === skuId) : []

  const columns: ColumnsType<typeof filtered[number]> = [
    { title: '日期', dataIndex: 'inventory_date' },
    {
      title: '剩余',
      render: (_, record) => record.total_qty - record.frozen_qty - record.sold_qty,
    },
    { title: '冻结', dataIndex: 'frozen_qty' },
    { title: '已售', dataIndex: 'sold_qty' },
    { title: '总量', dataIndex: 'total_qty' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
  ]

  const submitInit = (values: any) => {
    if (!values.sku_id || !values.range) {
      message.error('请选择 SKU 与日期区间')
      return
    }
    const days = dateRange(values.range[0].format('YYYY-MM-DD'), values.range[1].format('YYYY-MM-DD'))
    initInventory(values.sku_id, days, values.total_qty, '运营.yu', values.reason)
    message.success('已批量初始化/调整库存')
  }

  const submitAdjust = (values: any) => {
    adjust(values.sku_id, values.inventory_date.format('YYYY-MM-DD'), values.total_qty, '运营.yu', values.remark)
    message.success('已人工调整库存，写入日志')
    addLog({
      table_name: 'inventory',
      record_id: `${values.sku_id}-${values.inventory_date.format('YYYY-MM-DD')}`,
      operation: 'UPDATE',
      diff_data: { total: values.total_qty, remark: values.remark },
      source: '人工调整',
    })
  }

  return (
    <div className="page">
      <PageHeader title="M6 库存" subtitle="日历视图 + 批量初始化 + 人工调整，全部留痕" />
      <Space align="start" size={12} style={{ width: '100%' }}>
        <Card title="库存日历视图（按 SKU）" style={{ flex: 1 }}>
          <Space style={{ marginBottom: 12 }}>
            <Select
              placeholder="选择 SKU"
              style={{ width: 240 }}
              options={skus.map((s) => ({ value: s.id, label: s.sku_name }))}
              onChange={(value) => setSkuId(value)}
            />
          </Space>
          <Table rowKey="id" size="small" dataSource={filtered} columns={columns} pagination={{ pageSize: 10 }} />
        </Card>
        <div style={{ width: 360 }}>
          <Card title="初始化 / 批量录入">
            <Form layout="vertical" form={form} onFinish={submitInit}>
              <Form.Item name="sku_id" label="SKU" rules={[{ required: true }]}>
                <Select options={skus.map((s) => ({ value: s.id, label: s.sku_name }))} />
              </Form.Item>
              <Form.Item name="range" label="日期区间" rules={[{ required: true }]}>
                <RangePicker />
              </Form.Item>
              <Form.Item name="total_qty" label="总库存" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="reason" label="原因">
                <Input />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                批量写入
              </Button>
            </Form>
          </Card>

          <Card title="人工调整" style={{ marginTop: 12 }}>
            <Form layout="vertical" form={adjustForm} onFinish={submitAdjust}>
              <Form.Item name="sku_id" label="SKU" rules={[{ required: true }]}>
                <Select options={skus.map((s) => ({ value: s.id, label: s.sku_name }))} />
              </Form.Item>
              <Form.Item name="inventory_date" label="日期" rules={[{ required: true }]}>
                <DatePicker />
              </Form.Item>
              <Form.Item name="total_qty" label="调整后总量" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                写入审计日志
              </Button>
            </Form>
          </Card>
        </div>
      </Space>

      <Card title="库存流水" style={{ marginTop: 12 }}>
        <Table
          size="small"
          rowKey="id"
          dataSource={inventoryLog.slice(0, 50)}
          columns={[
            { title: 'SKU', dataIndex: 'sku_id' },
            { title: '日期', dataIndex: 'inventory_date' },
            { title: '操作', dataIndex: 'change_type' },
            { title: '前', render: (_, r) => `${r.before_qty.total}/${r.before_qty.frozen}/${r.before_qty.sold}` },
            { title: '后', render: (_, r) => `${r.after_qty.total}/${r.after_qty.frozen}/${r.after_qty.sold}` },
            { title: '订单', dataIndex: 'related_order_id' },
            { title: '人', dataIndex: 'operator' },
            { title: '时间', dataIndex: 'operated_at' },
          ]}
        />
      </Card>
      <Card size="small" style={{ marginTop: 8 }} title="规则提示">
        <Tag color="blue">冻结=支付成功</Tag> <Tag color="green">核销=冻结-1 & 已售+1</Tag> <Tag color="red">库存不足禁止下单</Tag>
      </Card>
    </div>
  )
}
