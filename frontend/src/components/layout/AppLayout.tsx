import { Layout, Menu, Button, Avatar, Dropdown, Space, ConfigProvider, theme, Badge } from 'antd'
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
    MenuUnfoldOutlined,
    PictureOutlined
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
    const canSeeFiles = ['super_admin', 'admin', 'product', 'operator'].includes(role)

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
                    { key: '/resources/poi', label: '资源管理' },
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
        ...(canSeeFiles ? [{
            key: '/files',
            icon: <PictureOutlined />,
            label: '文件管理',
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

    return (
        <ConfigProvider theme={{
            algorithm: theme.defaultAlgorithm,
            token: { colorPrimary: '#f5222d', colorBgContainer: '#ffffff', borderRadius: 8 }
        }}>
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
                        background: 'rgba(255,255,255,0.7)',
                    }}
                    theme="light"
                >
                    {/* Living Logo */}
                    <div style={{
                        height: 90,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: '1px solid rgba(0,0,0,0.03)'
                    }}>
                        {!collapsed ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.05 }}
                                style={{
                                    fontSize: '24px',
                                    fontWeight: '900',
                                    fontFamily: 'Outfit, sans-serif',
                                    letterSpacing: '-0.5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                <motion.div
                                    animate={{
                                        boxShadow: ["0 0 0px #f5222d", "0 0 20px #f5222d", "0 0 0px #f5222d"],
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    style={{
                                        width: 12, height: 12, background: 'var(--primary-color)',
                                        borderRadius: '50%'
                                    }}
                                />
                                <span style={{
                                    background: 'linear-gradient(90deg, #f5222d, #ff7a45)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent'
                                }}>RED PIG</span>
                            </motion.div>
                        ) : (
                            <motion.div whileHover={{ rotate: 180 }} transition={{ type: "spring" }}>
                                <div style={{
                                    width: 36, height: 36,
                                    background: 'var(--primary-color)',
                                    borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 'bold', color: '#fff',
                                    boxShadow: '0 4px 15px rgba(245,34,45,0.4)'
                                }}>R</div>
                            </motion.div>
                        )}
                    </div>

                    <div style={{ height: 'calc(100% - 90px)', overflowY: 'auto', padding: '16px 8px' }}>
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
                    transition: 'margin-left 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    minHeight: '100vh',
                    marginRight: 16
                }}>
                    <Header style={{
                        padding: '0 24px',
                        background: 'rgba(255, 255, 255, 0.65)',
                        backdropFilter: 'blur(16px)',
                        marginTop: 16,
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: 72,
                        border: '1px solid rgba(255,255,255,0.5)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <Button
                                type="text"
                                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                                onClick={() => setCollapsed(!collapsed)}
                                style={{ fontSize: '18px' }}
                            />
                        </div>

                        <Space size="large">
                            <motion.div whileHover={{ rotate: 15 }} style={{ cursor: 'pointer' }}>
                                <Badge dot color="red">
                                    <BellOutlined style={{ fontSize: '20px', color: '#555' }} />
                                </Badge>
                            </motion.div>

                            <Dropdown menu={userMenu} placement="bottomRight">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    style={{
                                        cursor: 'pointer',
                                        padding: '4px 6px 4px 12px',
                                        borderRadius: '30px',
                                        background: 'white',
                                        border: '1px solid #eee',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>{user?.username || 'Admin'}</span>
                                    <Avatar size="default" style={{ background: 'linear-gradient(135deg, #f5222d, #ff7875)' }} icon={<UserOutlined />} />
                                </motion.div>
                            </Dropdown>
                        </Space>
                    </Header>

                    <Content style={{ marginTop: 24, marginBottom: 24, minHeight: 280, position: 'relative' }}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                style={{ width: '100%' }}
                            >
                                <Outlet />
                            </motion.div>
                        </AnimatePresence>
                    </Content>
                </Layout>
            </Layout>
        </ConfigProvider>
    )
}
