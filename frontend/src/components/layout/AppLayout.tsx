import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd'
import {
    DashboardOutlined,
    DatabaseOutlined,
    ShoppingOutlined,
    AppstoreOutlined,
    LogoutOutlined,
    UserOutlined,
    BellOutlined,

    CheckCircleOutlined,
    BarChartOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const { Header, Sider, Content } = Layout

export default function AppLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuth()
    const [collapsed, setCollapsed] = useState(false)


    const role = user?.role || 'guest'

    // Helper to check permissions
    const canSeeResources = ['super_admin', 'admin', 'product'].includes(role)
    const canSeeProducts = ['super_admin', 'admin', 'product'].includes(role)
    const canSeeGoods = ['super_admin', 'admin', 'product', 'operator', 'csr'].includes(role) // SKU, Pricing, Inv, Channel
    const canSeeOrders = ['super_admin', 'admin', 'csr', 'operator'].includes(role)
    const canSeeApprovals = ['super_admin', 'admin', 'product'].includes(role)
    const canSeeOpData = ['super_admin', 'admin', 'operator'].includes(role)
    const canSeeLogs = ['super_admin', 'admin'].includes(role)
    const canSeeReports = ['super_admin', 'admin'].includes(role)
    const canSeeUsers = role === 'super_admin'

    // Goods Center Sub-items Filtering
    const showSkuList = ['super_admin', 'admin', 'product', 'operator'].includes(role)
    const showChannelList = ['super_admin', 'admin', 'product', 'operator', 'csr'].includes(role)
    const showPricing = ['super_admin', 'admin', 'product', 'csr', 'operator'].includes(role) // CSR can enter Pricing/Inv
    const showInventory = ['super_admin', 'admin', 'product', 'csr', 'operator'].includes(role)

    const allMenuItems = [
        ...(canSeeResources ? [{
            key: 'resource-center',
            icon: <DatabaseOutlined />,
            label: '资源中心',
            children: [
                { key: '/resources/poi', label: 'POI 管理' },
                { key: '/resources/list', label: '资源管理' },
                { key: '/suppliers/list', label: '供应商管理' },
            ]
        }] : []),
        ...(canSeeProducts ? [{
            key: 'products',
            icon: <ShoppingOutlined />,
            label: '产品管理',
            children: [
                { key: '/products/list', label: '产品列表' },
                { key: '/products/categories', label: '产品分类' },
                { key: '/products/editor', label: '产品编辑' },
            ]
        }] : []),
        ...(canSeeGoods ? [{
            key: 'product-center',
            icon: <AppstoreOutlined />,
            label: '商品中心',
            children: [
                {
                    key: 'skus',
                    label: 'SKU & 渠道',
                    type: 'group' as const,
                    children: [
                        ...(showSkuList ? [{ key: '/skus/list', label: 'SKU 管理' }] : []),
                        ...(showChannelList ? [{ key: '/skus/channels', label: '渠道管理' }] : []),
                    ]
                },
                ...(showPricing ? [{
                    key: 'pricing',
                    label: '定价中心',
                    type: 'group' as const,
                    children: [
                        { key: '/pricing/center', label: 'SKU 价格/库存中心' },
                    ]
                }] : []),
                ...(showInventory ? [{
                    key: 'inventory',
                    label: '库存管理',
                    type: 'group' as const,
                    children: [
                        { key: '/inventory/calendar', label: '库存数据' },
                    ]
                }] : [])
            ]
        }] : []),
        ...(canSeeOrders ? [{
            key: 'orders',
            icon: <ShoppingOutlined />,
            label: '订单中心',
            children: [
                { key: '/orders/list', label: '订单列表' },
                { key: '/orders/import', label: '批量导入' },
            ]
        }] : []),
        ...(canSeeOpData ? [{
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '运营数据',
        }] : []),
        ...(canSeeApprovals ? [{
            key: 'approvals',
            icon: <CheckCircleOutlined />,
            label: '审批与审计',
            children: [
                { key: '/approvals/pending', label: '待审批' },
            ]
        }] : []),
        ...(canSeeLogs ? [{
            key: 'logs',
            icon: <BarChartOutlined />,
            label: '操作日志',
            children: [
                { key: '/logs/operations', label: '操作日志' },
            ]
        }] : []),
        ...(canSeeReports ? [{
            key: 'reports',
            icon: <BarChartOutlined />,
            label: '报表中心',
            children: [
                { key: '/reports/sales', label: '销售报表' },
                { key: '/reports/profit', label: '利润分析' },
            ]
        }] : []),
        ...(canSeeUsers ? [{
            key: '/admin/users',
            icon: <UserOutlined />,
            label: '用户管理',
            children: [], // Ensure consistent type if other items have children
        }] : []),
    ]

    const menuItems = allMenuItems

    const userMenu = {
        items: [
            {
                key: 'profile',
                icon: <UserOutlined />,
                label: '个人中心',
            },
            {
                type: 'divider' as const,
            },
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: '退出登录',
                danger: true,
                onClick: logout,
            }
        ]
    }

    // Handle menu click
    const handleMenuClick = (e: { key: string }) => {
        navigate(e.key)
    }

    // Determine selected keys (simple implementation)
    const selectedKeys = [location.pathname]
    const defaultOpenKeys = menuItems
        .filter(item => item.children?.some(child => location.pathname.startsWith(child.key)))
        .map(item => item.key)

    return (
        <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
            <Sider
                width={260}
                collapsible
                collapsed={collapsed}
                onCollapse={setCollapsed}
                className="glass-panel"
                style={{
                    margin: '16px 0 16px 16px',
                    borderRadius: '24px',
                    height: 'calc(100vh - 32px)',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 100,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
                }}
                theme="light"
            >
                <div style={{
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid rgba(0,0,0,0.03)'
                }}>
                    {!collapsed && (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{
                                fontSize: '20px',
                                fontWeight: '800',
                                background: 'linear-gradient(45deg, #ff4d4f, #ff7a45)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                fontFamily: 'Outfit, sans-serif',
                                letterSpacing: '-0.5px'
                            }}>
                            RED PIG DB
                        </motion.span>
                    )}
                    {collapsed && (
                        <div style={{
                            width: 32,
                            height: 32,
                            background: 'linear-gradient(135deg, #ff4d4f, #f5222d)',
                            borderRadius: 10,
                            boxShadow: '0 4px 10px rgba(245,34,45,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '16px'
                        }}>P</div>
                    )}
                </div>

                <div style={{ height: 'calc(100% - 80px)', overflowY: 'auto', paddingRight: collapsed ? 0 : 4 }}>
                    <Menu
                        mode="inline"
                        defaultSelectedKeys={selectedKeys}
                        defaultOpenKeys={defaultOpenKeys}
                        selectedKeys={selectedKeys}
                        items={menuItems}
                        onClick={handleMenuClick}
                        style={{ border: 'none', background: 'transparent', padding: '12px 0' }}
                    />
                </div>
            </Sider>

            <Layout style={{
                background: 'transparent',
                marginLeft: collapsed ? 80 : 276,
                transition: 'all 0.2s ease-in-out',
                minHeight: '100vh'
            }}>
                <Header style={{
                    padding: '0 24px',
                    background: 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                    margin: '16px 16px 0 0',
                    borderRadius: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    height: 72,
                    border: '1px solid rgba(255,255,255,0.5)'
                }}>
                    <Space size="large">
                        <Button type="text" shape="circle" icon={<BellOutlined />} style={{ color: '#64748b' }} />
                        <div style={{ width: 1, height: 24, background: '#cbd5e1' }} />
                        <Dropdown menu={userMenu} placement="bottomRight">
                            <Space style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: '30px', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.5)' }}>
                                <Avatar style={{ backgroundColor: '#ff4d4f' }} icon={<UserOutlined />} />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>{user?.username || 'User'}</span>
                            </Space>
                        </Dropdown>
                    </Space>
                </Header>

                <Content style={{
                    margin: '16px 16px 16px 0',
                    minHeight: 280,
                    borderRadius: '24px',
                    overflow: 'visible',
                    position: 'relative'
                }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            style={{ width: '100%', height: '100%' }}
                        >
                            <div className="glass-panel" style={{
                                minHeight: '100%',
                                padding: '24px',
                                background: 'rgba(255, 255, 255, 0.55)',
                                backdropFilter: 'blur(10px)',
                            }}>
                                <Outlet />
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </Content>
            </Layout>
        </Layout>
    )
}
