import { Row, Col, Statistic, Table } from 'antd'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'

const COLORS = ['#ff4d4f', '#52c41a', '#1890ff', '#faad14', '#722ed1']

interface TopItem {
    key: string
    gmv: number
    profit: number
    orders: number
}

export default function ProfitReportPage() {
    const [totalProfit, setTotalProfit] = useState(0)
    const [totalCost, setTotalCost] = useState(0)
    const [totalRevenue, setTotalRevenue] = useState(0)
    const [topSku, setTopSku] = useState<TopItem[]>([])

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const res = await apiRequest<{ trend: { gmv: number; profit: number }[]; top_sku: TopItem[] }>(`/api/reports/summary`)
                const trend = res.trend || []
                const revenue = trend.reduce((sum, item) => sum + (item.gmv || 0), 0)
                const profit = trend.reduce((sum, item) => sum + (item.profit || 0), 0)
                setTotalRevenue(revenue)
                setTotalProfit(profit)
                setTotalCost(revenue - profit)
                setTopSku(res.top_sku || [])
            } catch {
                setTotalRevenue(0)
                setTotalProfit(0)
                setTotalCost(0)
                setTopSku([])
            }
        }
        fetchSummary()
    }, [])

    const pieData = [
        { name: '渠道A', value: 4000 },
        { name: '渠道B', value: 3000 },
        { name: '渠道C', value: 2000 },
        { name: '渠道D', value: 2780 },
        { name: '其他', value: 1890 },
    ]

    const columns = [
        { title: 'SKU', dataIndex: 'key' },
        { title: '销售额', dataIndex: 'gmv', render: (v: number) => `¥${v}` },
        { title: '成本', dataIndex: 'cost', render: (v: number) => `¥${v || 0}` },
        { title: '利润', dataIndex: 'profit', render: (v: number) => `¥${v || 0}` },
        {
            title: '利润率',
            render: (_: any, record: any) => {
                const rate = record.gmv > 0 ? (record.profit / record.gmv) * 100 : 0
                return `${rate.toFixed(2)}%`
            },
        },
    ]

    const tableData = topSku.map(item => ({
        ...item,
        cost: item.gmv - item.profit,
    }))

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">利润报表 (M9)</h1>
                <p className="page-subtitle">利润与成本分析</p>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic title="总营收" value={totalRevenue} prefix="¥" valueStyle={{ color: '#ff4d4f' }} />
                    </div>
                </Col>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic title="总成本" value={totalCost} prefix="¥" valueStyle={{ color: '#1890ff' }} />
                    </div>
                </Col>
                <Col xs={24} sm={8}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <Statistic title="总利润" value={totalProfit} prefix="¥" valueStyle={{ color: '#52c41a' }} />
                    </div>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col xs={24} lg={12}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '16px' }}>利润分布</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {pieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Col>

                <Col xs={24} lg={12}>
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ marginBottom: '16px' }}>SKU利润详情</h3>
                        <Table
                            columns={columns}
                            dataSource={tableData}
                            rowKey="key"
                            pagination={false}
                            size="small"
                        />
                    </div>
                </Col>
            </Row>
        </div>
    )
}
