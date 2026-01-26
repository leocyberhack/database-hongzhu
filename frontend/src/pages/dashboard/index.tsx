import { Col, Row, Table, Tag, Button } from 'antd'
import { AccountBookOutlined, ShoppingCartOutlined, UsergroupAddOutlined, RiseOutlined } from '@ant-design/icons'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useData } from '@/contexts/DataContext'
import { motion } from 'framer-motion'
import CountUp from 'react-countup'

export default function DashboardPage() {
    const { data, loading } = useData()

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
        { title: '总收入 (Revenue)', value: 112893, prefix: '¥', icon: <AccountBookOutlined />, color: '#f5222d', growth: 12.5 },
        { title: '活跃订单 (Orders)', value: 893, prefix: '', icon: <ShoppingCartOutlined />, color: '#52c41a', growth: 8.2 },
        { title: '新增用户 (Users)', value: 32, prefix: '+', icon: <UsergroupAddOutlined />, color: '#1677ff', growth: 24.1 },
    ]

    // Animation Variants
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    }

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
    }

    return (
        <motion.div
            className="page-container"
            variants={container}
            initial="hidden"
            animate="show"
        >
            <div className="page-header">
                <div>
                    <motion.h1
                        className="page-title"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        经营看板
                    </motion.h1>
                    <motion.p
                        className="page-subtitle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        欢迎回来，这里是您的实时运营数据中心
                    </motion.p>
                </div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                    <Tag
                        color="#f50"
                        style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            border: 'none',
                            boxShadow: '0 4px 10px rgba(255, 85, 0, 0.3)'
                        }}
                    >
                        <span className="animate-pulse">●</span> LIVE UPDATE
                    </Tag>
                </motion.div>
            </div>

            <Row gutter={[24, 24]}>
                {stats.map((stat, i) => (
                    <Col xs={24} sm={8} key={i}>
                        <motion.div variants={item}>
                            <div className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <p style={{ color: '#8c8c8c', marginBottom: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
                                        {stat.title}
                                    </p>
                                    <div style={{ fontSize: '36px', fontWeight: '800', fontFamily: 'Outfit', color: '#1f1f1f' }}>
                                        <span style={{ fontSize: '24px', marginRight: 4, verticalAlign: 'top', marginTop: 4, display: 'inline-block' }}>{stat.prefix}</span>
                                        <CountUp end={stat.value} separator="," duration={2.5} />
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '13px', color: stat.color, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                                        <div style={{ background: `${stat.color}20`, padding: '2px 6px', borderRadius: '6px' }}>
                                            <RiseOutlined /> +{stat.growth}%
                                        </div>
                                        <span style={{ color: '#999' }}>vs last week</span>
                                    </div>
                                </div>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '20px',
                                    background: `linear-gradient(135deg, ${stat.color}10, ${stat.color}05)`,
                                    color: stat.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '28px',
                                    border: `1px solid ${stat.color}20`
                                }}>
                                    {stat.icon}
                                </div>
                            </div>
                        </motion.div>
                    </Col>
                ))}

                <Col xs={24} lg={16}>
                    <motion.div variants={item} style={{ height: '100%' }}>
                        <div className="glass-card" style={{ padding: '28px', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '18px' }}>收入趋势分析</h3>
                                    <span style={{ color: '#999', fontSize: '12px' }}>Gross Merchandise Value</span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {['Day', 'Week', 'Month'].map(t => (
                                        <div key={t} style={{
                                            fontSize: '12px',
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            background: t === 'Week' ? '#f5222d' : '#f5f5f5',
                                            color: t === 'Week' ? 'white' : '#666',
                                            boxShadow: t === 'Week' ? '0 4px 10px rgba(245,34,45,0.3)' : 'none'
                                        }}>
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ height: '320px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f5222d" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#f5222d" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <Tooltip
                                            cursor={{ stroke: '#f5222d', strokeWidth: 1, strokeDasharray: '4 4' }}
                                            contentStyle={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                            itemStyle={{ color: '#f5222d', fontWeight: 600 }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="gmv"
                                            stroke="#f5222d"
                                            strokeWidth={4}
                                            fillOpacity={1}
                                            fill="url(#colorGmv)"
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </motion.div>
                </Col>

                <Col xs={24} lg={8}>
                    <motion.div variants={item} style={{ height: '100%' }}>
                        <div className="glass-card" style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '24px 24px 0 24px' }}>
                                <h3 style={{ marginBottom: '4px' }}>最近订单</h3>
                                <p style={{ color: '#999', fontSize: '12px', marginBottom: '20px' }}>Latest Transactions</p>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <Table
                                    dataSource={data?.orders.slice(0, 5) || []}
                                    loading={loading}
                                    pagination={false}
                                    rowKey="id"
                                    size="middle"
                                    columns={[
                                        {
                                            title: 'Information', dataIndex: 'order_no', render: (t) => (
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#333' }}>{t}</div>
                                                    <div style={{ fontSize: '11px', color: '#999' }}>2 mins ago</div>
                                                </div>
                                            )
                                        },
                                        { title: 'Amount', dataIndex: 'sale_amount', align: 'right', render: (v) => <span style={{ color: '#f5222d', fontWeight: 700 }}>+¥{v}</span> },
                                    ]}
                                />
                            </div>
                            <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                                <Button type="dashed" block>View All Orders</Button>
                            </div>
                        </div>
                    </motion.div>
                </Col>
            </Row>
        </motion.div>
    )
}
