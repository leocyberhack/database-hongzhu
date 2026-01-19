import { Layout, Menu, Button, Avatar, Dropdown, Space, ConfigProvider, theme } from 'antd'
import {
    DashboardOutlined,
    DatabaseOutlined,
    ShoppingOutlined,
    AppstoreOutlined,
    LogoutOutlined,
    UserOutlined,
    BellOutlined,
    CheckCircleOutlined,
    BarChartOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined
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
    const canSeeGoods = ['super_admin', 'admin', 'product', 'operator', 'csr'].includes(role)
    const canSeeOrders = ['super_admin', 'admin', 'csr', 'operator'].includes(role)
    const canSeeApprovals = ['super_admin', 'admin', 'product'].includes(role)
    const canSeeOpData = ['super_admin', 'admin', 'operator'].includes(role)
    const canSeeLogs = ['super_admin', 'admin'].includes(role)
    const canSeeReports = ['super_admin', 'admin'].includes(role)
    const canSeeUsers = role === 'super_admin'

    const showSkuList = ['super_admin', 'admin', 'product', 'operator'].includes(role)
    const showChannelList = ['super_admin', 'admin', 'product', 'operator', 'csr'].includes(role)
    const showPricing = ['super_admin', 'admin', 'product', 'csr', 'operator'].includes(role)
    const showInventory = ['super_admin', 'admin', 'product', 'csr', 'operator'].includes(role)

    const menuItems = [
        ...(canSeeOpData ? [{
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '运营数据',
        }] : []),
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
        }] : []),
    ]

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

    const handleMenuClick = (e: { key: string }) => {
        navigate(e.key)
    }

    const selectedKeys = [location.pathname]
    const defaultOpenKeys = menuItems
        .filter(item => item.children?.some(child => location.pathname.startsWith(child.key)))
        .map(item => item.key)

    // Config for Light Mode
    const lightTheme = {
        algorithm: theme.defaultAlgorithm,
        token: {
            colorPrimary: '#f5222d',
            colorBgContainer: '#ffffff',
            colorText: '#1f1f1f',
        },
        components: {
            Menu: {
                itemBg: 'transparent',
                subMenuItemBg: 'transparent',
            }
        }
    }

    return (
        <ConfigProvider theme={lightTheme}>
            <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
                <Sider
                    width={260}
                    trigger={null}
                    collapsible
                    collapsed={collapsed}
                    className="glass-panel"
                    style={{
                        margin: '16px 0 16px 16px',
                        height: 'calc(100vh - 32px)',
                        position: 'fixed',
                        left: 0,
                        top: 0,
                        zIndex: 100,
                        borderRight: 'none',
                        overflow: 'hidden',
                        background: 'rgba(255,255,255,0.85)' // Light Sidebar
                    }}
                    theme="light"
                >
                    {/* Logo Section */}
                    <div style={{
                        height: 80,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: '1px solid var(--border-dim)'
                    }}>
                        {!collapsed ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    fontSize: '22px',
                                    fontWeight: '900',
                                    fontFamily: 'Outfit, sans-serif',
                                    letterSpacing: '-0.5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                <div style={{
                                    width: 10, height: 10, background: 'var(--primary-color)',
                                    borderRadius: '50%', boxShadow: '0 0 10px rgba(245,34,45,0.4)'
                                }} />
                                <span style={{
                                    background: 'linear-gradient(90deg, #f5222d, #ff7a45)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}>RED PIG</span>
                            </motion.div>
                        ) : (
                            <div style={{
                                width: 32, height: 32,
                                background: 'var(--primary-color)',
                                borderRadius: 8,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 'bold', color: '#fff',
                                boxShadow: '0 4px 10px rgba(245,34,45,0.3)'
                            }}>R</div>
                        )}
                    </div>

                    <div style={{
                        height: 'calc(100% - 80px)',
                        overflowY: 'auto',
                        padding: '16px 8px'
                    }}>
                        <Menu
                            mode="inline"
                            defaultSelectedKeys={selectedKeys}
                            defaultOpenKeys={defaultOpenKeys}
                            selectedKeys={selectedKeys}
                            items={menuItems}
                            onClick={handleMenuClick}
                            style={{ background: 'transparent', border: 'none' }}
                        />
                    </div>
                </Sider>

                <Layout style={{
                    background: 'transparent',
                    marginLeft: collapsed ? 96 : 276,
                    transition: 'margin-left 0.2s ease-in-out',
                    minHeight: '100vh',
                    marginRight: 16
                }}>
                    <Header style={{
                        padding: '0 24px',
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(10px)',
                        marginTop: 16,
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: 72,
                        border: '1px solid var(--border-dim)',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                    }}>
                        <Button
                            type="text"
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                            style={{ color: 'var(--text-secondary)' }}
                        />

                        <Space size="large">
                            <Button type="text" shape="circle" icon={<BellOutlined />} style={{ color: 'var(--text-secondary)' }} />

                            <Dropdown menu={userMenu} placement="bottomRight">
                                <Space style={{
                                    cursor: 'pointer',
                                    padding: '4px 12px',
                                    borderRadius: '30px',
                                    background: 'rgba(0,0,0,0.02)',
                                    border: '1px solid var(--border-dim)'
                                }}>
                                    <Avatar size="small" style={{ backgroundColor: '#fff1f0', color: '#f5222d' }} icon={<UserOutlined />} />
                                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)' }}>{user?.username || 'User'}</span>
                                </Space>
                            </Dropdown>
                        </Space>
                    </Header>

                    <Content style={{
                        marginTop: 16,
                        marginBottom: 16,
                        minHeight: 280,
                        overflow: 'visible',
                        position: 'relative'
                    }}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 15, scale: 0.99 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -15, scale: 0.99 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <div className="glass-panel" style={{
                                    minHeight: '100%',
                                    padding: '32px',
                                }}>
                                    <Outlet />
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </Content>
                </Layout>
            </Layout>
        </ConfigProvider>
    )
}
