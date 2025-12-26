import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis, Line, LineChart } from 'recharts'
import { Card, DatePicker, Select, Space, Statistic, Tabs } from 'antd'
import dayjs from 'dayjs'
import PageHeader from '../../components/PageHeader'
import { useOrdersStore } from '../../store/orders'
import { aggregateByDate, aggregateTop } from '../../utils/data'

const { RangePicker } = DatePicker

export default function ReportCenterPage() {
  const { orders } = useOrdersStore()
  const [grain, setGrain] = useState<'day' | 'week' | 'month'>('day')
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const filtered = useMemo(() => {
    if (!range) return orders
    return orders.filter((o) => {
      const d = dayjs(o.created_at)
      return !d.isBefore(range[0]) && !d.isAfter(range[1])
    })
  }, [orders, range])

  const trend = aggregateByDate(filtered, grain)
  const topChannel = aggregateTop(filtered, 'channel_id')
  const topSku = aggregateTop(filtered, 'sku_id')
  const topProduct = aggregateTop(filtered, 'product_id')

  const kpi = {
    gmv: filtered.reduce((s, o) => s + o.sale_amount, 0),
    profit: filtered.reduce((s, o) => s + (o.profit_amount ?? 0), 0),
    orders: filtered.length,
  }

  return (
    <div className="page">
      <PageHeader title="报表中心" subtitle="日/周/月切换，KPI+趋势+TopN，下钻订单列表" />
      <Card style={{ marginBottom: 12 }}>
        <Space>
          <Select value={grain} onChange={setGrain} options={[{ value: 'day', label: '按日' }, { value: 'week', label: '按周' }, { value: 'month', label: '按月' }]} />
          <RangePicker onChange={(val) => setRange(val as any)} />
        </Space>
      </Card>

      <Space size={12} style={{ display: 'flex' }}>
        <Card style={{ flex: 1 }}>
          <Statistic title="销售额" value={kpi.gmv} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Statistic title="利润" value={kpi.profit} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Statistic title="订单数" value={kpi.orders} />
        </Card>
      </Space>

      <Tabs
        style={{ marginTop: 12 }}
        items={[
          {
            key: 'trend',
            label: '趋势图',
            children: (
              <Card>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="key" />
                    <YAxis />
                    <ChartTooltip />
                    <Line dataKey="gmv" stroke="#ff7a45" name="GMV" />
                    <Line dataKey="profit" stroke="#52c41a" name="利润" />
                    <Line dataKey="orders" stroke="#1890ff" name="订单数" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            ),
          },
          {
            key: 'top',
            label: 'TopN',
            children: (
              <Space size={12} style={{ display: 'flex' }}>
                <Card style={{ flex: 1 }} title="Top 渠道">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topChannel}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="key" />
                      <YAxis />
                      <ChartTooltip />
                      <Bar dataKey="gmv" fill="#ff9a62" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card style={{ flex: 1 }} title="Top SKU">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topSku}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="key" />
                      <YAxis />
                      <ChartTooltip />
                      <Bar dataKey="gmv" fill="#5b8ff9" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card style={{ flex: 1 }} title="Top 产品">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topProduct}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="key" />
                      <YAxis />
                      <ChartTooltip />
                      <Bar dataKey="gmv" fill="#34c38f" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Space>
            ),
          },
        ]}
      />
    </div>
  )
}
