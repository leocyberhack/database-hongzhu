import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import AppRoutes from './AppRoutes'
import { AuthProvider } from './contexts/AuthContext'
import zhCN from 'antd/locale/zh_CN'
import './index.css'

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          fontFamily: "'Inter', system-ui, sans-serif",
          colorPrimary: '#ff4d4f',
          borderRadius: 8,
          wireframe: false,
        },
        components: {
          Card: {
            boxShadowTertiary: '0 4px 12px rgba(0,0,0,0.05)',
          },
          Button: {
            controlHeight: 36,
          }
        }
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
