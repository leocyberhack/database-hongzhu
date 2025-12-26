import { Tag } from 'antd'

const colorMap: Record<string, string> = {
  草稿: 'default',
  待审批: 'gold',
  上架: 'green',
  下架: 'default',
  生效: 'blue',
  已失效: 'default',
  已支付: 'processing',
  已核销: 'green',
  已退款: 'red',
  可供: 'green',
  暂停: 'orange',
}

export default function StatusTag({ status }: { status: string }) {
  return <Tag color={colorMap[status] || 'default'}>{status}</Tag>
}
