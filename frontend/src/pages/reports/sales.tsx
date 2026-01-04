import { Row, Col, Statistic, Select, DatePicker } from 'antd'
import { ArrowUpOutlined } from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useData } from '@/contexts/DataContext'

export default function SalesReportPage() {
    const { data } = useData()
    const orders = data?.orders ?? []

    // Mock chart data
    const chartData = [
        { date: '01-01', sales: 12000, orders: 45 },
        { date: '01-02', sales: 19000, orders: 62 },
        { date: '01-03', sales: 15000, orders: 51 },
        { date: '01-04', sales: 22000, orders: 73 },
        { date: '01-05', sales: 18000, orders: 58 },
        { date: '01-06', sales: 25000, orders: 82 },
        { date: '01-07', sales: 31000, orders: 95 },
    ]

    const totalSales = orders.reduce((sum, o) => sum + o.sale_amount, 0)
    const totalOrders = orders.length

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">销售报表 (M9)</h1>
                <p className="page-subtitle">销售数据分析与统计</p>
            </div>

            <div className="glass-card" style={{ padding: '16px', marginBottom: '16px' }}>
                <DatePicker.RangePicker style={{ marginRight: '16px' }} />
                <Select placeholder="选择渠道" style={{ width: 200, marginRight: '16px' }} />
                <Select placeholder="选择SKU" style={{ width: 200 }} />
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic
                            title="总销售额"
                            value={totalSales}
                            prefix="¥"
                            valueStyle={{ color: '#ff4d4f' }}
                            suffix={
                                <span style={{ fontSize: '14px', color: '#52c41a' }}>
                                    <ArrowUpOutlined /> 12%
                                </span>
                            }
                        />
                    </div>
                </Col>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic title="订单总数" value={totalOrders} valueStyle={{ color: '#1890ff' }} />
                    </div>
                </Col>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic
                            title="平均订单金额"
                            value={totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0}
                            prefix="¥"
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </div>
                </Col>
            </Row>

            <div className="glass-card" style={{ padding: '24px', marginTop: '16px' }}>
                <h3 style={{ marginBottom: '16px' }}>销售趋势</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="sales" stroke="#ff4d4f" strokeWidth={2} />
                        <Line type="monotone" dataKey="orders" stroke="#1890ff" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
