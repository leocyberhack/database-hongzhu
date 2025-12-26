import { Card, Col, List, Progress, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import { useMemo } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart } from 'recharts'
import PageHeader from '../../components/PageHeader'
import { useOrdersStore } from '../../store/orders'
import { useInventoryStore } from '../../store/inventory'
import { useApprovalsStore } from '../../store/approvals'
import { usePricesStore } from '../../store/prices'
import { aggregateByDate, aggregateTop, countStockAlerts } from '../../utils/data'
import StatusTag from '../../components/StatusTag'

const { Text } = Typography

const KPI = ({ title, value, suffix }: { title: string; value: number; suffix?: string }) => (
  <Card size="small">
    <Statistic title={title} value={value} precision={2} suffix={suffix} />
  </Card>
)

export function ManagementDashboard() {
  const { orders } = useOrdersStore()

  const metrics = useMemo(() => {
    const gmv = orders.reduce((sum, o) => sum + o.sale_amount, 0)
    const profit = orders.reduce((sum, o) => sum + (o.profit_amount ?? 0), 0)
    const orderCnt = orders.length
    const verified = orders.filter((o) => o.status === '已核销').length
    const refunded = orders.filter((o) => o.status === '已退款').length
    const kpis = {
      gmv,
      profit,
      orderCnt,
      verifyRate: orderCnt ? (verified / orderCnt) * 100 : 0,
      profitRate: gmv ? (profit / gmv) * 100 : 0,
      refundRate: orderCnt ? (refunded / orderCnt) * 100 : 0,
    }
    const trend = aggregateByDate(orders, 'day')
    const topChannel = aggregateTop(orders, 'channel_id')
    const topSku = aggregateTop(orders, 'sku_id')
    const topProduct = aggregateTop(orders, 'product_id')
    return { kpis, trend, topChannel, topSku, topProduct }
  }, [orders])

  return (
    <div className="page">
      <PageHeader title="管理层经营看板" subtitle="GMV / 利润 / 核销率可快速查看，并支持 TopN 下钻" />
      <Row gutter={12}>
        <Col span={4}>
          <KPI title="销售额 (GMV)" value={metrics.kpis.gmv} />
        </Col>
        <Col span={4}>
          <KPI title="利润" value={metrics.kpis.profit} />
        </Col>
        <Col span={4}>
          <KPI title="订单数" value={metrics.kpis.orderCnt} />
        </Col>
        <Col span={4}>
          <KPI title="核销率" value={metrics.kpis.verifyRate} suffix="%" />
        </Col>
        <Col span={4}>
          <KPI title="利润率" value={metrics.kpis.profitRate} suffix="%" />
        </Col>
        <Col span={4}>
          <KPI title="退款率" value={metrics.kpis.refundRate} suffix="%" />
        </Col>
      </Row>

      <Card style={{ marginTop: 12 }} title="近 30 天趋势">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={metrics.trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="key" />
            <YAxis />
            <ChartTooltip />
            <Line type="monotone" dataKey="gmv" stroke="#ff7a45" name="GMV" />
            <Line type="monotone" dataKey="profit" stroke="#52c41a" name="利润" />
            <Line type="monotone" dataKey="orders" stroke="#1890ff" name="订单数" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={8}>
          <Card title="Top 渠道">
            <List
              dataSource={metrics.topChannel}
              renderItem={(item) => (
                <List.Item actions={[<Text type="secondary">GMV {item.gmv}</Text>]}>
                  <List.Item.Meta title={item.key} description={`订单 ${item.orders} · 利润 ${item.profit}`} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Top SKU">
            <List
              dataSource={metrics.topSku}
              renderItem={(item) => (
                <List.Item actions={[<Text type="secondary">GMV {item.gmv}</Text>]}>
                  <List.Item.Meta title={item.key} description={`订单 ${item.orders} · 利润 ${item.profit}`} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Top 产品">
            <List
              dataSource={metrics.topProduct}
              renderItem={(item) => (
                <List.Item actions={[<Text type="secondary">GMV {item.gmv}</Text>]}>
                  <List.Item.Meta title={item.key} description={`订单 ${item.orders} · 利润 ${item.profit}`} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export function OperationDashboard() {
  const { approvals } = useApprovalsStore()
  const { inventory } = useInventoryStore()
  const { orders } = useOrdersStore()

  const alertCount = countStockAlerts(inventory)
  const pendingApprovals = approvals.filter((a) => a.status === '待审批')
  const abnormalProfit = orders.filter((o) => (o.profit_amount ?? 0) < 0)
  const costMissing = orders.filter((o) => o.cost_price == null || o.cost_amount == null)

  return (
    <div className="page">
      <PageHeader title="运营看板" subtitle="缺库存预警、待审批、异常利润一屏可见" />
      <Row gutter={12}>
        <Col span={6}>
          <Card>
            <Statistic title="待审批" value={pendingApprovals.length} />
            <List
              size="small"
              dataSource={pendingApprovals.slice(0, 5)}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Tag color="gold">{item.object_type}</Tag>
                    <Text>{item.action_type}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="缺库存预警（未来7天）" value={alertCount} />
            <Progress percent={Math.min(100, (alertCount / Math.max(1, inventory.length)) * 100)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="成本缺失订单" value={costMissing.length} />
            <List size="small" dataSource={costMissing.slice(0, 5)} renderItem={(item) => <List.Item>{item.order_no}</List.Item>} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="异常利润订单" value={abnormalProfit.length} />
            <List size="small" dataSource={abnormalProfit.slice(0, 5)} renderItem={(item) => <List.Item>{item.order_no}</List.Item>} />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 12 }} title="订单核销进度">
        <Table
          size="small"
          pagination={false}
          dataSource={orders.slice(0, 8)}
          columns={[
            { title: '订单号', dataIndex: 'order_no' },
            { title: 'SKU', dataIndex: 'sku_id' },
            { title: '出行日', dataIndex: 'travel_date' },
            { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
            { title: 'GMV', dataIndex: 'sale_amount' },
            { title: '利润', dataIndex: 'profit_amount' },
          ]}
          rowKey="id"
        />
      </Card>
    </div>
  )
}

export function ProductDashboard() {
  const { prices } = usePricesStore()
  const { approvals } = useApprovalsStore()

  const priceOps = prices.filter((p) => p.status !== '草稿').length
  const pendingProductApprovals = approvals.filter((a) => a.object_type === 'product' && a.status === '待审批')

  const barData = useMemo(
    () =>
      prices.reduce<Record<string, { channel: string; count: number }>>((acc, cur) => {
        acc[cur.channel_id] = { channel: cur.channel_id, count: (acc[cur.channel_id]?.count ?? 0) + 1 }
        return acc
      }, {}),
    [prices],
  )

  return (
    <div className="page">
      <PageHeader title="产品看板" subtitle="结构判重 / 调价频次 / 审批进度" />
      <Row gutter={12}>
        <Col span={8}>
          <Card>
            <Statistic title="价格操作次数（含历史）" value={priceOps} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="待审批产品" value={pendingProductApprovals.length} />
            <List
              size="small"
              dataSource={pendingProductApprovals}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Tag color="gold">{item.action_type}</Tag>
                    <Text>{item.object_id}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="价格时间冲突样例" value={prices.filter((p) => p.status === '草稿').length} suffix="草稿待处理" />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginTop: 12 }} title="渠道维度价格覆盖">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={Object.values(barData)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="channel" />
            <YAxis />
            <ChartTooltip />
            <Bar dataKey="count" fill="#ff7a45" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
