import { Col, Row, Table, Tag } from 'antd'
import { ArrowUpOutlined, AccountBookOutlined, ShoppingCartOutlined, UsergroupAddOutlined } from '@ant-design/icons'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useData } from '@/contexts/DataContext'

export default function DashboardPage() {
    const { data, loading } = useData()

    // Fake data for charts
    const chartData = [
        { name: 'Mon', gmv: 4000, orders: 2400 },
        { name: 'Tue', gmv: 3000, orders: 1398 },
        { name: 'Wed', gmv: 2000, orders: 9800 },
        { name: 'Thu', gmv: 2780, orders: 3908 },
        { name: 'Fri', gmv: 1890, orders: 4800 },
        { name: 'Sat', gmv: 2390, orders: 3800 },
        { name: 'Sun', gmv: 3490, orders: 4300 },
    ]

    const stats = [
        { title: '总收入 (Revenue)', value: 112893, prefix: '¥', icon: <AccountBookOutlined />, color: '#f5222d' },
        { title: '活跃订单 (Orders)', value: 893, prefix: '', icon: <ShoppingCartOutlined />, color: '#52c41a' },
        { title: '新增用户 (Users)', value: 32, prefix: '+', icon: <UsergroupAddOutlined />, color: '#1677ff' },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">经营看板</h1>
                    <p className="page-subtitle">
                        运营数据实时监控此面板
                    </p>
                </div>
                <Tag color="red">LIVE</Tag>
            </div>

            <Row gutter={[24, 24]}>
                {stats.map((stat, i) => (
                    <Col xs={24} sm={8} key={i}>
                        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ color: '#8c8c8c', marginBottom: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    {stat.title}
                                </p>
                                <div style={{ fontSize: '32px', fontWeight: '700', fontFamily: 'Outfit', color: '#1f1f1f' }}>
                                    {stat.prefix}{stat.value.toLocaleString()}
                                </div>
                                <div style={{ marginTop: '8px', fontSize: '12px', color: stat.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ArrowUpOutlined /> <span style={{ opacity: 0.8 }}>较上周增长 12%</span>
                                </div>
                            </div>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                background: `${stat.color}15`, // Light tint
                                color: stat.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                            }}>
                                {stat.icon}
                            </div>
                        </div>
                    </Col>
                ))}

                <Col xs={24} lg={16}>
                    <div className="glass-card" style={{ padding: '24px', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0 }}>收入趋势 (GMV)</h3>
                            <div style={{ color: '#f5222d', fontSize: '12px', border: '1px solid #ffccc7', padding: '2px 8px', borderRadius: '4px', background: '#fff1f0' }}>7 DAYS</div>
                        </div>

                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f5222d" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#f5222d" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#666', fontSize: 12 }} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #f0f0f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        itemStyle={{ color: '#f5222d' }}
                                    />
                                    <Area type="monotone" dataKey="gmv" stroke="#f5222d" strokeWidth={3} fillOpacity={1} fill="url(#colorGmv)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </Col>

                <Col xs={24} lg={8}>
                    <div className="glass-card" style={{ padding: '24px', height: '100%' }}>
                        <h3 style={{ marginBottom: '24px' }}>最近订单</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <Table
                                dataSource={data?.orders.slice(0, 5) || []}
                                loading={loading}
                                pagination={false}
                                rowKey="id"
                                size="small"
                                columns={[
                                    { title: '订单号', dataIndex: 'order_no', render: (t) => <span style={{ fontFamily: 'monospace', color: '#1f1f1f' }}>{t}</span> },
                                    { title: '金额', dataIndex: 'sale_amount', render: (v) => <span style={{ color: '#cf1322', fontWeight: 500 }}>¥{v}</span> },
                                    {
                                        title: '状态', dataIndex: 'status', render: (s) => (
                                            <Tag color={s === 'verified' ? 'success' : 'processing'} bordered={false} style={{ margin: 0 }}>
                                                {s.toUpperCase()}
                                            </Tag>
                                        )
                                    }
                                ]}
                            />
                            {(!data || data.orders.length === 0) && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#ccc' }}>暂无数据</div>
                            )}
                        </div>
                    </div>
                </Col>
            </Row>
        </div>
    )
}
