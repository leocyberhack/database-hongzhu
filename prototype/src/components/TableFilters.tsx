import type { ReactNode } from 'react'
import { Card, Space } from 'antd'

export default function TableFilters({ children }: { children: ReactNode }) {
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space size={12} wrap>
        {children}
      </Space>
    </Card>
  )
}
