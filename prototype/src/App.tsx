import { Spin } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import AppLayout from './app/AppLayout'
import MockDataProvider, { useMockDataContext } from './app/MockDataProvider'
import AppRoutes from './app/routes'

function AppContent() {
  const { loading } = useMockDataContext()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="正在加载 mock 数据..." />
      </div>
    )
  }

  return (
    <AppLayout>
      <AppRoutes />
    </AppLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <MockDataProvider>
        <AppContent />
      </MockDataProvider>
    </BrowserRouter>
  )
}
