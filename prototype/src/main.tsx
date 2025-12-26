import React from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp, ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import 'antd/dist/reset.css'
import './styles/index.css'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'

dayjs.extend(isBetween)
dayjs.extend(isSameOrBefore)

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#FF5B29',
          colorInfo: '#FF5B29',
          borderRadius: 8,
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
)
