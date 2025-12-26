import { useState } from 'react'
import { Button, Card, List, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import DiffViewer from '../../components/DiffViewer'
import { useApprovalsStore } from '../../store/approvals'
import { usePricesStore } from '../../store/prices'
import { useMockDataContext } from '../../app/MockDataProvider'
import { useAuditLogStore } from '../../store/auditLog'
import type { Approval } from '../../types'

const describeChanges = (before: any, after: any) => {
  const items: string[] = []
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    keys.forEach((k) => {
      const prev = (before as any)[k]
      const next = (after as any)[k]
      if (prev !== next) {
        items.push(`${k}: ${prev ?? '空'} → ${next ?? '空'}`)
      }
    })
  }
  return items.length ? items : ['数据变更见右侧 diff']
}

export function ApprovalsPage() {
  const { approvals } = useApprovalsStore()
  const [current, setCurrent] = useState<Approval | null>(approvals.find((a) => a.status === '待审批') ?? null)

  const columns: ColumnsType<Approval> = [
    { title: '对象', dataIndex: 'object_type', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '动作', dataIndex: 'action_type' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    { title: '提交人', dataIndex: 'applicant' },
    { title: '提交时间', dataIndex: 'applied_at' },
    {
      title: '操作',
      render: (_, record) => (
        <Button type="link" onClick={() => setCurrent(record)}>
          查看
        </Button>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader title="我的待审批" subtitle="通过时执行真实业务状态变化并写入 audit_log" />
      <Space align="start" size={12} style={{ width: '100%' }}>
        <Card title="审批队列" style={{ flex: 1 }}>
          <Table rowKey="id" dataSource={approvals} columns={columns} pagination={{ pageSize: 8 }} />
        </Card>
        {current && <ApprovalDetailPage approval={current} />}
      </Space>
    </div>
  )
}

export function ApprovalDetailPage({ approval }: { approval: Approval }) {
  const { decide } = useApprovalsStore()
  const { activatePrice, addHistory } = usePricesStore()
  const { data, updateData } = useMockDataContext()
  const { addLog } = useAuditLogStore()

  const approve = () => {
    decide(approval.id, '通过')
    if (approval.object_type === 'price') {
      activatePrice(approval.object_id)
      addHistory({
        price_id: approval.object_id,
        before_data: approval.before_data,
        after_data: approval.after_data,
        operator: approval.approver,
      })
    }
    if (approval.object_type === 'product') {
      updateData(
        'products',
        (data?.products ?? []).map((p) => (p.id === approval.object_id ? { ...p, status: '上架' } : p)),
      )
    }
    if (approval.object_type === 'sku') {
      updateData(
        'skus',
        (data?.skus ?? []).map((s) => (s.id === approval.object_id ? { ...s, status: '上架' } : s)),
      )
    }
    addLog({
      table_name: approval.object_type,
      record_id: approval.object_id,
      operation: 'APPROVAL_PASS',
      diff_data: approval.after_data,
      source: '审批',
    })
    message.success('已通过并生效')
  }

  const reject = () => {
    decide(approval.id, '驳回')
    message.info('已驳回')
  }

  return (
    <Card title={`审批详情 #${approval.id}`} style={{ width: 520 }}>
      <p>
        对象：<Tag color="blue">{approval.object_type}</Tag> 动作：{approval.action_type} 状态：<StatusTag status={approval.status} />
      </p>
      <List
        size="small"
        header="摘要"
        dataSource={describeChanges(approval.before_data, approval.after_data)}
        renderItem={(item) => <List.Item>{item}</List.Item>}
        style={{ marginBottom: 8 }}
      />
      <DiffViewer before={approval.before_data} after={approval.after_data} />
      <Space style={{ marginTop: 12 }}>
        <Button type="primary" onClick={approve}>
          通过并生效
        </Button>
        <Button danger onClick={reject}>
          驳回
        </Button>
      </Space>
    </Card>
  )
}

export function AuditLogPage() {
  const { logs } = useAuditLogStore()
  const opLabel: Record<string, string> = {
    INSERT: '新增',
    UPDATE: '更新',
    STATUS_CHANGE: '状态变更',
    APPROVAL_PASS: '审批通过',
  }
  const tableLabel: Record<string, string> = {
    price: '定价',
    sku: 'SKU',
    product: '产品',
    inventory: '库存',
    order: '订单',
    supplier: '供应商',
  }

  return (
    <div className="page">
      <PageHeader title="审计日志" subtitle="记录调价、上下架、库存调整、订单状态变化" />
      <Card>
        <Table
          size="small"
          rowKey="id"
          dataSource={logs}
          columns={[
            { title: '对象', dataIndex: 'table_name', render: (v: string) => tableLabel[v] || v },
            { title: '记录ID', dataIndex: 'record_id' },
            { title: '操作', dataIndex: 'operation', render: (v: string) => opLabel[v] || v },
            { title: '时间', dataIndex: 'operated_at' },
            {
              title: '摘要',
              render: (_, r) => {
                const diff: any = r.diff_data
                if (typeof diff === 'string') return diff
                if (diff?.status) return `状态变更为 ${diff.status}`
                if (diff?.after?.sale_price) return `价格调整至 ${diff.after.sale_price}`
                if (diff?.total) return `库存调整为 ${diff.total}`
                return JSON.stringify(diff)
              },
            },
            { title: '来源', dataIndex: 'source' },
          ]}
        />
      </Card>
    </div>
  )
}
