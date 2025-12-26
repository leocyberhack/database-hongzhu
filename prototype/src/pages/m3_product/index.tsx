import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, List, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { nanoid } from 'nanoid'
import { useParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import { useMockDataContext } from '../../app/MockDataProvider'
import { buildStructureHash } from '../../utils/hash'
import type { Product, ProductResource } from '../../types'
import { useOrdersStore } from '../../store/orders'

const { Paragraph } = Typography

export function ProductListPage() {
  const { data } = useMockDataContext()
  const products = data?.products ?? []
  const productResources = data?.product_resources ?? []

  const columns: ColumnsType<Product> = [
    { title: '产品名', dataIndex: 'product_name' },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
    { title: '资源数', render: (_, record) => productResources.filter((pr) => pr.product_id === record.id).length },
    { title: '结构指纹', dataIndex: 'structure_hash', width: 220 },
  ]

  return (
    <div className="page">
      <PageHeader title="M3 产品列表" subtitle="资源组合唯一判重，点击进入详情/编辑" />
      <Table<Product>
        rowKey="id"
        columns={columns}
        dataSource={products}
        expandable={{
          expandedRowRender: (record) => (
            <List
              size="small"
              dataSource={productResources.filter((pr) => pr.product_id === record.id)}
              renderItem={(item) => (
                <List.Item>
                  {item.resource_id} ×{item.quantity} {item.required_flag ? <Tag color="blue">必选</Tag> : null}
                </List.Item>
              )}
            />
          ),
        }}
      />
    </div>
  )
}

export function ProductDetailPage() {
  const { data, updateData } = useMockDataContext()
  const params = useParams()
  const current = data?.products?.find((p) => p.id === params.id) ?? data?.products?.[0] ?? null
  const productResources = data?.product_resources ?? []
  const snapshots = data?.product_structure_snapshot ?? []

  const copyToNew = () => {
    if (!current) return
    const newId = nanoid(8)
    const copied: Product = { ...current, id: newId, status: '草稿', product_name: `${current.product_name}-副本` }
    const newResources = productResources
      .filter((pr) => pr.product_id === current.id)
      .map<ProductResource>((pr) => ({ ...pr, id: nanoid(8), product_id: newId }))
    updateData('products', [copied, ...(data?.products ?? [])])
    updateData('product_resources', [...newResources, ...productResources])
    message.success('已复制为新产品，可前往编辑')
  }

  if (!current) return null

  return (
    <div className="page">
      <PageHeader
        title="产品详情"
        subtitle="查看结构快照，已有订单的产品禁止改结构，支持复制为新产品"
        actions={[
          <Button key="copy" onClick={copyToNew} type="primary">
            复制为新产品
          </Button>,
        ]}
      />
      <Card title={current.product_name}>
        <Paragraph copyable>结构指纹：{current.structure_hash}</Paragraph>
        <List
          header="资源组成"
          dataSource={productResources.filter((pr) => pr.product_id === current.id)}
          renderItem={(item) => (
            <List.Item>
              {item.resource_id} ×{item.quantity} {item.required_flag ? <Tag color="blue">必选</Tag> : <Tag>可选</Tag>}
            </List.Item>
          )}
        />
        <Card size="small" title="结构快照" style={{ marginTop: 12 }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(snapshots.find((s) => s.product_id === current.id)?.snapshot_data, null, 2)}</pre>
        </Card>
      </Card>
    </div>
  )
}

export function ProductEditorPage() {
  const { data, updateData } = useMockDataContext()
  const { orders } = useOrdersStore()
  const params = useParams()
  const [form] = Form.useForm()
  const [lineForm] = Form.useForm()
  const [selectedResources, setSelectedResources] = useState<ProductResource[]>([])
  const resources = data?.resources ?? []
  const products = data?.products ?? []
  const productResources = data?.product_resources ?? []
  const editingProduct = params.id ? products.find((p) => p.id === params.id) : null
  const hasOrder = editingProduct ? orders.some((o) => o.product_id === editingProduct.id) : false

  useEffect(() => {
    if (editingProduct) {
      form.setFieldsValue({ product_name: editingProduct.product_name, description: editingProduct.description })
      setSelectedResources(productResources.filter((pr) => pr.product_id === editingProduct.id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProduct])

  const structureHash = buildStructureHash(selectedResources)
  const duplicate = products.find((p) => p.structure_hash === structureHash)

  const addResourceLine = () => {
    const values = lineForm.getFieldsValue()
    if (!values.resource_id || !values.quantity) return
    const line: ProductResource = {
      id: nanoid(8),
      product_id: editingProduct?.id ?? 'temp',
      resource_id: values.resource_id,
      quantity: values.quantity,
      required_flag: values.required_flag ?? true,
      remark: values.remark,
    }
    setSelectedResources((prev) => [...prev, line])
    lineForm.resetFields()
  }

  const saveProduct = (values: any) => {
    if (hasOrder) {
      message.error('产品已有订单，禁止改结构，请复制为新产品')
      return
    }
    if (selectedResources.length === 0) {
      message.error('请选择至少一个资源')
      return
    }
    const hash = buildStructureHash(selectedResources)
    const exists = products.find((p) => p.structure_hash === hash)
    if (exists) {
      Modal.confirm({
        title: '命中已有产品',
        content: `结构指纹命中 ${exists.product_name}，可跳转查看/复用，仍要创建吗？`,
        okText: '仍创建',
        onOk: () => persist(values, hash),
      })
    } else {
      persist(values, hash)
    }
  }

  const persist = (values: any, hash: string) => {
    const productId = editingProduct?.id ?? nanoid(8)
    const product: Product = {
      id: productId,
      product_name: values.product_name,
      description: values.description,
      status: '草稿',
      structure_hash: hash,
    }
    const lines = selectedResources.map((line) => ({ ...line, product_id: productId, id: nanoid(8) }))
    if (editingProduct) {
      updateData('products', products.map((p) => (p.id === productId ? product : p)))
      updateData(
        'product_resources',
        productResources.filter((pr) => pr.product_id !== productId).concat(lines),
      )
    } else {
      updateData('products', [product, ...products])
      updateData('product_resources', [...lines, ...productResources])
    }
    message.success('产品保存成功')
  }

  return (
    <div className="page">
      <PageHeader
        title="产品编辑"
        subtitle="结构变更实时生成 structure_hash，命中已有产品提示复用"
        actions={
          hasOrder ? <Alert type="warning" message="已有订单，禁止改结构，请复制为新产品" showIcon /> : <Tag color="blue">草稿</Tag>
        }
      />
      <Space align="start" size={12} style={{ width: '100%' }}>
        <Card style={{ flex: 1 }} title="基础信息">
          <Form layout="vertical" form={form} onFinish={saveProduct}>
            <Form.Item name="product_name" label="产品名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Alert
              type={duplicate ? 'warning' : 'info'}
              showIcon
              message={duplicate ? `结构命中 ${duplicate.product_name}，建议复用或跳转查看` : '实时生成 structure_hash'}
              description={<Paragraph copyable>{structureHash}</Paragraph>}
              style={{ marginBottom: 12 }}
            />
            <Button type="primary" htmlType="submit" disabled={hasOrder}>
              保存草稿
            </Button>
          </Form>
        </Card>
        <Card title="资源组合" style={{ width: 420 }}>
          <Form layout="vertical" form={lineForm} onFinish={addResourceLine}>
            <Form.Item name="resource_id" label="资源" rules={[{ required: true }]}>
              <Select
                showSearch
                options={resources.map((r) => ({ value: r.id, label: `${r.resource_name} (${r.resource_type})` }))}
              />
            </Form.Item>
            <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="required_flag" label="必选" initialValue={true}>
              <Select
                options={[
                  { value: true, label: '必选' },
                  { value: false, label: '可选' },
                ]}
              />
            </Form.Item>
            <Form.Item name="remark" label="备注">
              <Input />
            </Form.Item>
            <Button type="dashed" onClick={addResourceLine} block>
              添加到结构
            </Button>
          </Form>
          <List
            header="已选资源"
            dataSource={selectedResources}
            style={{ marginTop: 12, maxHeight: 240, overflow: 'auto' }}
            renderItem={(item, idx) => (
              <List.Item
                actions={[
                  <Button
                    key="remove"
                    type="link"
                    size="small"
                    onClick={() => setSelectedResources((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    删除
                  </Button>,
                ]}
              >
                {item.resource_id} ×{item.quantity} {item.required_flag ? <Tag color="blue">必选</Tag> : <Tag>可选</Tag>}
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </div>
  )
}
