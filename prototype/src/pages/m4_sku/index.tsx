import { useMemo, useState } from 'react'
import { Button, Card, Drawer, Form, Input, Select, Space, Table, Tabs, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { nanoid } from 'nanoid'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import { useMockDataContext } from '../../app/MockDataProvider'
import { usePricesStore } from '../../store/prices'
import { useInventoryStore } from '../../store/inventory'
import { skuShelfGates } from '../../utils/validators'
import type { Sku, SkuChannel } from '../../types'

export default function SkuPage() {
  const { data, updateData } = useMockDataContext()
  const { prices } = usePricesStore()
  const { inventory } = useInventoryStore()
  const [channelForm] = Form.useForm()
  const [selected, setSelected] = useState<Sku | null>(null)
  const skus = data?.skus ?? []
  const channels = data?.channels ?? []
  const skuChannels = data?.sku_channels ?? []

  const columns: ColumnsType<Sku> = [
    { title: 'SKU 名称', dataIndex: 'sku_name' },
    { title: '产品', dataIndex: 'product_id' },
    { title: '售卖期', render: (_, record) => `${record.sale_start ?? '-'} ~ ${record.sale_end ?? '-'}` },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
  ]

  const gateIssues = selected
    ? skuShelfGates({
        skuId: selected.id,
        skuChannels,
        prices,
        inventory,
      })
    : []

  const selectedChannels = useMemo(
    () => skuChannels.filter((sc) => sc.sku_id === selected?.id).map((sc) => ({ ...sc, channel: channels.find((c) => c.id === sc.channel_id) })),
    [channels, selected?.id, skuChannels],
  )

  const addChannel = (values: any) => {
    const exists = skuChannels.find((sc) => sc.sku_id === selected?.id && sc.channel_id === values.channel_id)
    if (exists) {
      message.error('已绑定该渠道')
      return
    }
    const record: SkuChannel = {
      id: nanoid(8),
      sku_id: selected?.id ?? '',
      channel_id: values.channel_id,
      channel_sku_code: values.channel_sku_code,
      status: '上架',
    }
    updateData('sku_channels', [record, ...skuChannels])
    message.success('已绑定渠道')
    channelForm.resetFields()
  }

  return (
    <div className="page">
      <PageHeader title="M4 SKU & 渠道" subtitle="SKU 上架闸门：价格+库存+渠道" />
      <Table<Sku> rowKey="id" columns={columns} dataSource={skus} onRow={(record) => ({ onClick: () => setSelected(record) })} />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width={800}
        title={
          <Space>
            <span>{selected?.sku_name}</span>
            <StatusTag status={selected?.status ?? ''} />
          </Space>
        }
      >
        {selected && (
          <Tabs
            items={[
              {
                key: 'channels',
                label: '渠道配置',
                children: (
                  <Space align="start" size={12} style={{ width: '100%' }}>
                    <Card title="已绑定渠道" style={{ flex: 1 }}>
                      <Table
                        size="small"
                        rowKey="id"
                        dataSource={selectedChannels}
                        pagination={false}
                        columns={[
                          { title: '渠道', dataIndex: ['channel', 'channel_name'] },
                          { title: '编码', dataIndex: 'channel_sku_code' },
                          { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
                        ]}
                      />
                    </Card>
                    <Card title="绑定渠道" style={{ width: 320 }}>
                      <Form layout="vertical" form={channelForm} onFinish={addChannel}>
                        <Form.Item name="channel_id" label="渠道" rules={[{ required: true }]}>
                          <Select options={channels.map((c) => ({ value: c.id, label: c.channel_name }))} />
                        </Form.Item>
                        <Form.Item name="channel_sku_code" label="渠道侧编码">
                          <Input />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" block>
                          绑定渠道
                        </Button>
                      </Form>
                      <Card size="small" type="inner" style={{ marginTop: 12 }}>
                        <p>上架闸门校验：</p>
                        {gateIssues.length ? (
                          gateIssues.map((issue) => (
                            <Tag color="red" key={issue}>
                              {issue}
                            </Tag>
                          ))
                        ) : (
                          <Tag color="green">已满足上架条件</Tag>
                        )}
                      </Card>
                    </Card>
                  </Space>
                ),
              },
              {
                key: 'price',
                label: '定价 (跳转)',
                children: (
                  <Card>
                    <p>当前生效价格：{prices.find((p) => p.sku_id === selected.id && p.status === '生效')?.sale_price ?? '缺失'}</p>
                    <Button type="link" href="/pricing">
                      前往调价
                    </Button>
                  </Card>
                ),
              },
              {
                key: 'inventory',
                label: '库存 (跳转)',
                children: (
                  <Card>
                    <p>未来 7 天库存：{inventory.filter((inv) => inv.sku_id === selected.id).length}</p>
                    <Button type="link" href="/inventory">
                      前往库存日历
                    </Button>
                  </Card>
                ),
              },
              {
                key: 'orders',
                label: '订单 (跳转)',
                children: (
                  <Card>
                    <Button type="link" href="/orders">
                      查看订单列表
                    </Button>
                  </Card>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  )
}
