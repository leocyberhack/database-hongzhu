import { Layout, Menu, Button, Avatar, Dropdown, Space } from 'antd'
import {
    DashboardOutlined,
    DatabaseOutlined,
    ShoppingOutlined,
    AppstoreOutlined,
    LogoutOutlined,
    UserOutlined,
    BellOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    BarChartOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

const { Header, Sider, Content } = Layout

export default function AppLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout } = useAuth()
    const [collapsed, setCollapsed] = useState(false)


    const menuItems = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: '经营看板',
        },
        {
            key: 'resource-center',
            icon: <DatabaseOutlined />,
            label: '资源中心',
            children: [
                { key: '/resources/poi', label: 'POI 管理' },
                { key: '/resources/list', label: '资源管理' },
                { key: '/suppliers/list', label: '供应商管理' },
            ]
        },
        {
            key: 'products',
            icon: <ShoppingOutlined />,
            label: '产品管理',
            children: [
                { key: '/products/list', label: '产品列表' },
                { key: '/products/editor', label: '产品编辑' },
            ]
        },
        {
            key: 'product-center',
            icon: <AppstoreOutlined />,
            label: '商品中心', // Goods Center
            children: [
                {
                    key: 'skus',
                    label: 'SKU & 渠道',
                    type: 'group',
                    children: [
                        { key: '/skus/list', label: 'SKU 管理' },
                        { key: '/skus/channels', label: '渠道管理' },
                    ]
                },
                {
                    key: 'pricing',
                    label: '定价中心',
                    type: 'group',
                    children: [
                        { key: '/pricing/center', label: 'SKU 价格/库存中心' },
                    ]
                },
                {
                    key: 'inventory',
                    label: '库存管理',
                    type: 'group',
                    children: [
                        { key: '/inventory/calendar', label: '库存数据' },
                    ]
                }
            ]
        },
        {
            key: 'orders',
            icon: <ShoppingOutlined />,
            label: '订单中心',
            children: [
                { key: '/orders/list', label: '订单列表' },
                { key: '/orders/import', label: '批量导入' },
            ]
        },
        {
            key: 'approvals',
            icon: <CheckCircleOutlined />,
            label: '审批与审计',
            children: [
                { key: '/approvals/pending', label: '待审批' },
                { key: '/approvals/audit', label: '审计日志' },
            ]
        },
        {
            key: 'reports',
            icon: <BarChartOutlined />,
            label: '报表中心',
            children: [
                { key: '/reports/sales', label: '销售报表' },
                { key: '/reports/profit', label: '利润分析' },
            ]
        },
        // 仅admin可见的用户管理菜单
        ...(user?.role === 'admin' ? [{
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
                    margin: '12px 0 12px 12px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.6)',
                    overflow: 'hidden',
                    zIndex: 10
                }}
                theme="light"
            >
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid rgba(0,0,0,0.03)'
                }}>
                    {!collapsed && (
                        <span style={{
                            fontSize: '18px',
                            fontWeight: '800',
                            background: 'linear-gradient(45deg, #ff4d4f, #ff7a45)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            fontFamily: 'Outfit, sans-serif'
                        }}>
                            RED PIG DB
                        </span>
                    )}
                    {collapsed && (
                        <div style={{
                            width: 32,
                            height: 32,
                            background: 'linear-gradient(135deg, #ff4d4f, #f5222d)',
                            borderRadius: 8,
                            boxShadow: '0 4px 10px rgba(245,34,45,0.3)'
                        }} />
                    )}
                </div>

                <Menu
                    mode="inline"
                    defaultSelectedKeys={selectedKeys}
                    defaultOpenKeys={defaultOpenKeys}
                    selectedKeys={selectedKeys}
                    items={menuItems}
                    onClick={handleMenuClick}
                    style={{ border: 'none', background: 'transparent', padding: '12px 0' }}
                />
            </Sider>

            <Layout style={{ background: 'transparent' }}>
                <Header style={{
                    padding: '0 24px',
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(10px)',
                    margin: '12px 12px 0 12px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                    height: 64
                }}>
                    <Space size="large">
                        <Button type="text" shape="circle" icon={<SearchOutlined />} />
                        <Button type="text" shape="circle" icon={<BellOutlined />} />
                        <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
                        <Dropdown menu={userMenu} placement="bottomRight">
                            <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.5)' }}>
                                <Avatar style={{ backgroundColor: '#ff4d4f' }} icon={<UserOutlined />} />
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>{user?.username || 'User'}</span>
                            </Space>
                        </Dropdown>
                    </Space>
                </Header>

                <Content style={{
                    margin: '12px',
                    minHeight: 280,
                    borderRadius: '16px',
                    overflow: 'auto'
                }}>
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    )
}
