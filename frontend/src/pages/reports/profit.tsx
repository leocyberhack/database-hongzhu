import { Row, Col, Statistic, Table } from 'antd'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useData } from '@/contexts/DataContext'

const COLORS = ['#ff4d4f', '#52c41a', '#1890ff', '#faad14', '#722ed1']

export default function ProfitReportPage() {
    const { data } = useData()
    const orders = data?.orders ?? []

    const totalProfit = orders.reduce((sum, o) => sum + (o.profit_amount || 0), 0)
    const totalCost = orders.reduce((sum, o) => sum + (o.cost_amount || 0), 0)
    const totalRevenue = orders.reduce((sum, o) => sum + o.sale_amount, 0)

    // Mock data for pie chart
    const pieData = [
        { name: '渠道A', value: 4000 },
        { name: '渠道B', value: 3000 },
        { name: '渠道C', value: 2000 },
        { name: '渠道D', value: 2780 },
        { name: '其他', value: 1890 },
    ]

    const columns = [
        { title: 'SKU', dataIndex: 'sku_id' },
        { title: '销售额', dataIndex: 'sale_amount', render: (v: number) => `¥${v}` },
        { title: '成本', dataIndex: 'cost_amount', render: (v: number) => `¥${v || 0}` },
        { title: '利润', dataIndex: 'profit_amount', render: (v: number) => `¥${v || 0}` },
        {
            title: '利润率',
            render: (_: any, record: any) => {
                const rate = record.sale_amount > 0 ? ((record.profit_amount || 0) / record.sale_amount) * 100 : 0
                return `${rate.toFixed(2)}%`
            },
        },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">利润分析 (M9)</h1>
                <p className="page-subtitle">利润与成本分析</p>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic title="总利润" value={totalProfit} prefix="¥" valueStyle={{ color: '#52c41a' }} />
                    </div>
                </Col>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic title="总成本" value={totalCost} prefix="¥" valueStyle={{ color: '#ff4d4f' }} />
                    </div>
                </Col>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic
                            title="利润率"
                            value={totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0}
                            suffix="%"
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </div>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
                <Col xs={24} lg={10}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '16px' }}>渠道利润分布</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" label>
                                    {pieData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Col>
                <Col xs={24} lg={14}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '16px' }}>订单利润明细</h3>
                        <Table rowKey="id" columns={columns} dataSource={orders.slice(0, 5)} pagination={false} size="small" />
                    </div>
                </Col>
            </Row>
        </div>
    )
}
