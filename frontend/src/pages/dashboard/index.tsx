import { Col, Row, Table, Tag } from 'antd'
import { ArrowUpOutlined, AccountBookOutlined, ShoppingCartOutlined, UsergroupAddOutlined } from '@ant-design/icons'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useData } from '@/contexts/DataContext'

export default function DashboardPage() {
    const { data, loading } = useData()

    // Fake data for charts since backend might return empty lists initially
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
        { title: '总收入', value: 112893, prefix: '¥', icon: <AccountBookOutlined />, color: '#ff4d4f' },
        { title: '活跃订单', value: 893, prefix: '', icon: <ShoppingCartOutlined />, color: '#52c41a' },
        { title: '新增用户', value: 32, prefix: '+', icon: <UsergroupAddOutlined />, color: '#1890ff' },
    ]

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">经营看板</h1>
                <p className="page-subtitle" style={{ color: '#1e293b' }}>
                    欢迎回到红猪数据库系统 · 数据来自后端API（若后端数据库为空则显示默认示例数据）
                </p>
            </div>

            <Row gutter={[24, 24]}>
                {stats.map((stat, i) => (
                    <Col xs={24} sm={8} key={i}>
                        <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ color: '#8c8c8c', marginBottom: '8px', fontSize: '14px' }}>{stat.title}</p>
                                <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: 'Outfit' }}>
                                    {stat.prefix}{stat.value.toLocaleString()}
                                </div>
                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#52c41a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <ArrowUpOutlined /> <span>较上周增长 12%</span>
                                </div>
                            </div>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: `${stat.color}15`,
                                color: stat.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '20px'
                            }}>
                                {stat.icon}
                            </div>
                        </div>
                    </Col>
                ))}

                <Col xs={24} lg={16}>
                    <div className="glass-card" style={{ padding: '24px', height: '100%' }}>
                        <h3 style={{ marginBottom: '24px' }}>收入趋势</h3>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="gmv" stroke="#ff4d4f" strokeWidth={3} fillOpacity={1} fill="url(#colorGmv)" />
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
                                    { title: '订单号', dataIndex: 'order_no', render: (t) => <span style={{ fontFamily: 'monospace' }}>{t}</span> },
                                    { title: '金额', dataIndex: 'sale_amount', render: (v) => `¥${v}` },
                                    {
                                        title: '状态', dataIndex: 'status', render: (s) => (
                                            <Tag color={s === 'verified' ? 'success' : 'processing'}>{s.toUpperCase()}</Tag>
                                        )
                                    }
                                ]}
                            />
                            {(!data || data.orders.length === 0) && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#ccc' }}>暂无订单</div>
                            )}
                        </div>
                    </div>
                </Col>
            </Row>
        </div>
    )
}
