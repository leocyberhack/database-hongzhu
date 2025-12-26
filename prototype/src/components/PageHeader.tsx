import type { ReactNode } from 'react'
import { Breadcrumb, Space, Typography } from 'antd'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  trail?: { title: string; path?: string }[]
}

export default function PageHeader({ title, subtitle, actions, trail }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        {trail && (
          <Breadcrumb style={{ marginBottom: 4 }}>
            {trail.map((item) => (
              <Breadcrumb.Item key={item.title}>{item.title}</Breadcrumb.Item>
            ))}
          </Breadcrumb>
        )}
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary" style={{ display: 'block' }}>
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {actions && <Space>{actions}</Space>}
    </div>
  )
}
