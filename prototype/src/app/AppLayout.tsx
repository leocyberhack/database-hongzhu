import type React from 'react'
import { Layout, Menu, Typography, Space, Badge, Button, Tooltip, Modal, List } from 'antd'
import {
  AuditOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloudSyncOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  DollarOutlined,
  FileSearchOutlined,
  InteractionOutlined,
  ProjectOutlined,
  ShopOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import './layout.css'
import { useState } from 'react'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const navItems = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    children: [
      { key: '/dashboard/management', label: <Link to="/dashboard/management">管理层经营看板</Link> },
      { key: '/dashboard/operation', label: <Link to="/dashboard/operation">运营看板</Link> },
      { key: '/dashboard/product', label: <Link to="/dashboard/product">产品看板</Link> },
    ],
  },
  {
    key: 'resource',
    icon: <DatabaseOutlined />,
    label: 'M2 资源库',
    children: [
      { key: '/resources/poi', label: <Link to="/resources/poi">POI 列表/新建</Link> },
      { key: '/resources/poi/detail', label: <Link to="/resources/poi?detail=1">POI 详情</Link> },
      { key: '/resources/new', label: <Link to="/resources/new">Resource 新建/详情</Link> },
    ],
  },
  {
    key: 'supplier',
    icon: <TeamOutlined />,
    label: 'M1 供应商',
    children: [
      { key: '/suppliers', label: <Link to="/suppliers">供应商列表/新建</Link> },
      { key: '/suppliers/detail', label: <Link to="/suppliers?detail=1">供应商详情</Link> },
    ],
  },
  {
    key: 'product',
    icon: <ProjectOutlined />,
    label: 'M3 产品',
    children: [
      { key: '/products', label: <Link to="/products">产品列表</Link> },
      { key: '/products/new', label: <Link to="/products/new">产品编辑</Link> },
    ],
  },
  {
    key: 'sku',
    icon: <ShopOutlined />,
    label: 'M4 SKU & 渠道',
    children: [
      { key: '/skus', label: <Link to="/skus">SKU 列表</Link> },
      { key: '/channels', label: <Link to="/channels">渠道管理</Link> },
    ],
  },
  {
    key: 'price',
    icon: <DollarOutlined />,
    label: 'M5 定价',
    children: [{ key: '/pricing', label: <Link to="/pricing">SKU 价格中心</Link> }],
  },
  {
    key: 'inventory',
    icon: <CalendarOutlined />,
    label: 'M6 库存',
    children: [{ key: '/inventory', label: <Link to="/inventory">库存日历/调整</Link> }],
  },
  {
    key: 'order',
    icon: <InteractionOutlined />,
    label: 'M7 订单',
    children: [
      { key: '/orders', label: <Link to="/orders">订单列表</Link> },
      { key: '/orders/new', label: <Link to="/orders/new">新建/导入</Link> },
    ],
  },
  {
    key: 'approval',
    icon: <CheckCircleOutlined />,
    label: 'M8 审批与审计',
    children: [
      { key: '/approvals', label: <Link to="/approvals">我的待审批</Link> },
      { key: '/audit-log', label: <Link to="/audit-log">审计日志</Link> },
    ],
  },
  {
    key: 'report',
    icon: <BarChartOutlined />,
    label: '报表中心',
    children: [{ key: '/reports', label: <Link to="/reports">销售/利润/核销报表</Link> }],
  },
]

function findSelectedKeys(pathname: string) {
  const flatKeys = navItems.flatMap((item) => item.children?.map((child) => child.key) ?? [])
  const hit = flatKeys.find((k) => pathname.startsWith(k.replace('?detail=1', '')))
  return hit ? [hit] : []
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const selectedKeys = findSelectedKeys(location.pathname + location.search)
  const [importOpen, setImportOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={236} theme="light" className="app-sider">
        <div className="app-logo">
          <span className="logo-dot" />
          <div>
            <Text strong>红猪 OTA 内部原型</Text>
            <div className="logo-sub">Mock JSON / 无后端 / 前端态模拟审批</div>
          </div>
        </div>
        <Menu mode="inline" selectedKeys={selectedKeys} items={navItems} style={{ height: '100%' }} />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space size={12} align="center">
            <Badge status="processing" text="测试账号：pm.zhang / 运营.yu / 财务.chen" />
            <Badge status="warning" text="全部数据来源 /public/mock" />
            <Tooltip title="刷新 mock 数据">
              <Button type="text" size="small" icon={<CloudSyncOutlined />} onClick={() => window.location.reload()} />
            </Tooltip>
            <Tooltip title="下载 CSV 模板在各页导入按钮处">
              <Button type="text" size="small" icon={<FileSearchOutlined />} onClick={() => setImportOpen(true)}>
                查看导入规范
              </Button>
            </Tooltip>
          </Space>
          <Space>
            <Button type="primary" icon={<AuditOutlined />} onClick={() => setFlowOpen(true)}>
              上新链路演示
            </Button>
            <Button icon={<DeploymentUnitOutlined />} onClick={() => setChainOpen(true)}>
              跨模块链路：调价/订单
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 16 }}>{children}</Content>

        <Modal title="导入规范（CSV/JSON）" open={importOpen} onCancel={() => setImportOpen(false)} footer={null}>
          <List
            size="small"
            dataSource={[
              '支持 CSV/JSON；CSV 首行是表头，UTF-8 编码。',
              '订单导入：order_no,channel_id,sku_id,travel_date,quantity,sale_price,cost_price。',
              '库存导入：sku_id,inventory_date,total_qty。',
              '供给导入：supplier_id,resource_id,settlement_price。',
            ]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Modal>

        <Modal title="上新链路演示" open={flowOpen} onCancel={() => setFlowOpen(false)} footer={null}>
          <List
            size="small"
            dataSource={[
              '1) POI/资源判重：进入“资源库”新建，命中同名同城会提示候选，资源重复可强制创建。',
              '2) 产品结构 hash 判重：在“产品编辑”选资源，实时生成 hash，命中已有产品提示跳转/复用。',
              '3) SKU 上架闸门：在“SKU & 渠道”绑定渠道，确保有生效价格+未来7天库存，否则提示缺失项。',
            ]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Modal>

        <Modal title="跨模块链路：调价 + 订单" open={chainOpen} onCancel={() => setChainOpen(false)} footer={null}>
          <List
            size="small"
            dataSource={[
              '调价：定价中心复制生效版→修改区间/价格→前端阻断时间冲突→提交审批→审批通过自动失效旧版并截断 end_at。',
              '订单：订单页新建/导入自动冻结库存→核销=冻结-1 & 已售+1→退款=解冻→库存流水+审计日志可查。',
              '看板/报表：Dashboard 与报表中心实时读取前端态数据，刷新即可看到指标变化。',
            ]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Modal>
      </Layout>
    </Layout>
  )
}
