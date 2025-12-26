import { Card, Table, Tag } from 'antd'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import { useMockDataContext } from '../../app/MockDataProvider'

export default function ChannelPage() {
  const { data } = useMockDataContext()
  const channels = data?.channels ?? []

  return (
    <div className="page">
      <PageHeader title="渠道管理" subtitle="平台/子渠道层级展示，可用于 SKU 绑定" />
      <Card>
        <Table
          rowKey="id"
          dataSource={channels}
          columns={[
            { title: '渠道名称', dataIndex: 'channel_name' },
            { title: '类型', dataIndex: 'channel_type' },
            { title: '上级', dataIndex: 'parent_id', render: (v: string | null) => v || '-' },
            { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
            {
              title: '标签',
              render: (_, record) => (record.attrs?.city ? <Tag>{String(record.attrs.city)}</Tag> : '-'),
            },
          ]}
        />
      </Card>
    </div>
  )
}
