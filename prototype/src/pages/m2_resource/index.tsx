import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Divider, Drawer, Form, Input, List, Modal, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { nanoid } from 'nanoid'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import StatusTag from '../../components/StatusTag'
import { useMockDataContext } from '../../app/MockDataProvider'
import type { Poi, Resource, SupplierResource } from '../../types'

const RESOURCE_TYPES = ['门票', '酒店', '交通', '餐饮', '玩乐']

export default function ResourcePage() {
  const { data, updateData } = useMockDataContext()
  const [poiForm] = Form.useForm()
  const [resourceForm] = Form.useForm()
  const [poiEditForm] = Form.useForm()
  const [resourceEditForm] = Form.useForm()
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null)
  const [resourceEditing, setResourceEditing] = useState<Resource | null>(null)
  const [searchParams] = useSearchParams()
  const [detailAutoOpened, setDetailAutoOpened] = useState(false)

  const poiList = data?.poi ?? []
  const resources = data?.resources ?? []
  const suppliers = data?.suppliers ?? []
  const supplierResources = data?.supplier_resources ?? []

  const columns: ColumnsType<Poi> = [
    { title: 'POI 名称', dataIndex: 'poi_name' },
    { title: '城市', dataIndex: 'city' },
    { title: '类型', dataIndex: 'poi_type' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: '资源数',
      render: (_, record) => resources.filter((r) => r.poi_id === record.id).length,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags?: string[]) => tags?.map((t) => <Tag key={t}>{t}</Tag>),
    },
  ]

  const addPoi = (values: any) => {
    const duplicates = poiList.filter((poi) => poi.poi_name === values.poi_name && poi.city === values.city && poi.id !== values.id)
    if (duplicates.length) {
      Modal.confirm({
        title: '检测到同名同城 POI',
        content: `已存在 ${duplicates.length} 条候选，确认仍然强制创建吗？`,
        okText: '强制创建',
        cancelText: '取消',
        onOk: () => {
          const newPoi: Poi = { ...values, id: nanoid(8), status: 'active' }
          updateData('poi', [newPoi, ...poiList])
          message.success('已创建 POI')
        },
      })
      return
    }
    const newPoi: Poi = { ...values, id: nanoid(8), status: 'active' }
    updateData('poi', [newPoi, ...poiList])
    message.success('已创建 POI')
    poiForm.resetFields()
  }

  const savePoi = (values: any) => {
    if (!selectedPoi) return
    const next: Poi = {
      ...selectedPoi,
      poi_name: values.poi_name,
      city: values.city,
      poi_type: values.poi_type,
      tags: values.tags ? values.tags.split(',').map((t: string) => t.trim()) : [],
    }
    updateData(
      'poi',
      poiList.map((p) => (p.id === selectedPoi.id ? next : p)),
    )
    setSelectedPoi(next)
    message.success('POI 已保存')
  }

  const addResource = (values: any) => {
    let attrs = values.attrs
    if (typeof attrs === 'string' && attrs.trim()) {
      try {
        attrs = JSON.parse(attrs)
      } catch {
        message.error('扩展属性 JSON 解析失败')
        return
      }
    }
    if (!values.supplier_id) {
      message.error('请选择供应商（资源必须由供应商提供）')
      return
    }
    const payload = { ...values, attrs }
    const dup = resources.find(
      (r) => r.poi_id === payload.poi_id && r.resource_name === payload.resource_name && r.resource_type === payload.resource_type,
    )
    if (dup) {
      Modal.confirm({
        title: '可能重复资源',
        content: '同一 POI 下存在同名资源，是否仍然创建？',
        okText: '仍创建',
        onOk: () => {
          const newRes: Resource = { ...payload, id: nanoid(8), status: '草稿' }
          const link: SupplierResource = {
            id: nanoid(8),
            supplier_id: values.supplier_id,
            resource_id: newRes.id,
            supply_status: '可供',
            settlement_price: values.settlement_price ?? null,
            currency: 'CNY',
            priority: 1,
          }
          updateData('resources', [newRes, ...resources])
          updateData('supplier_resources', [link, ...supplierResources])
          message.success('资源已创建为草稿')
        },
      })
      return
    }
    const newRes: Resource = { ...payload, id: nanoid(8), status: '草稿' }
    const link: SupplierResource = {
      id: nanoid(8),
      supplier_id: values.supplier_id,
      resource_id: newRes.id,
      supply_status: '可供',
      settlement_price: values.settlement_price ?? null,
      currency: 'CNY',
      priority: 1,
    }
    updateData('resources', [newRes, ...resources])
    updateData('supplier_resources', [link, ...supplierResources])
    message.success('资源已创建')
    resourceForm.resetFields()
  }

  const suggestions = useMemo(() => {
    const name = poiForm.getFieldValue('poi_name')
    const city = poiForm.getFieldValue('city')
    if (!name || !city) return []
    return poiList.filter((poi) => poi.poi_name === name && poi.city === city)
  }, [poiForm, poiList])

  useEffect(() => {
    if (searchParams.get('detail') && !detailAutoOpened && poiList.length) {
      setSelectedPoi(poiList[0])
      setDetailAutoOpened(true)
    }
  }, [searchParams, poiList, detailAutoOpened])

  useEffect(() => {
    if (selectedPoi) {
      poiEditForm.setFieldsValue({
        poi_name: selectedPoi.poi_name,
        city: selectedPoi.city,
        poi_type: selectedPoi.poi_type,
        tags: selectedPoi.tags?.join(','),
      })
    }
  }, [selectedPoi, poiEditForm])

  return (
    <div className="page">
      <PageHeader title="M2 资源库" subtitle="POI 判重 + Resource 可能重复提示（允许强制创建）" />
      <Space align="start" style={{ width: '100%' }} size={12}>
        <Card style={{ flex: 1 }} title="POI 列表">
          <Table<Poi> rowKey="id" columns={columns} dataSource={poiList} pagination={{ pageSize: 6 }} onRow={(record) => ({ onClick: () => setSelectedPoi(record) })} />
        </Card>
        <div style={{ width: 360 }}>
          <Card title="新建 POI" style={{ marginBottom: 12 }}>
            <Form layout="vertical" form={poiForm} onFinish={addPoi}>
              <Form.Item name="poi_name" label="POI 名称" rules={[{ required: true }]}>
                <Input placeholder="如：丽江古城" />
              </Form.Item>
              <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                <Input placeholder="丽江" />
              </Form.Item>
              <Form.Item name="poi_type" label="类型">
                <Select options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))} allowClear />
              </Form.Item>
              {suggestions.length > 0 && (
                <Card size="small" type="inner" title="同名同城候选">
                  <List
                    size="small"
                    dataSource={suggestions}
                    renderItem={(item) => (
                      <List.Item>
                        <Space>
                          <span>{item.poi_name}</span>
                          <StatusTag status={item.status} />
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              )}
              <Button type="primary" htmlType="submit" block style={{ marginTop: 12 }}>
                创建 / 判重
              </Button>
            </Form>
          </Card>

          <Card title="新建 Resource">
            <Form layout="vertical" form={resourceForm} onFinish={addResource}>
              <Form.Item name="poi_id" label="关联 POI" rules={[{ required: true }]}>
                <Select
                  showSearch
                  options={poiList.map((p) => ({ value: p.id, label: `${p.poi_name} (${p.city})` }))}
                  placeholder="选择 POI"
                />
              </Form.Item>
              <Form.Item name="supplier_id" label="供应商" rules={[{ required: true }]}>
                <Select showSearch options={suppliers.map((s) => ({ value: s.id, label: s.supplier_name }))} placeholder="由谁提供" />
              </Form.Item>
              <Form.Item name="resource_name" label="资源名称" rules={[{ required: true }]}>
                <Input placeholder="如：成人票 / 豪华房" />
              </Form.Item>
              <Form.Item name="resource_type" label="资源类型">
                <Select options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))} />
              </Form.Item>
              <Form.Item name="settlement_price" label="结算价（可选，用于供给关系）">
                <Input placeholder="数字，留空表示待补" />
              </Form.Item>
              <Form.Item name="attrs" label="扩展属性(JSON)">
                <Input.TextArea rows={2} placeholder='{"entry":"电子票","valid_days":1}' />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                创建资源（重复提示）
              </Button>
            </Form>
          </Card>
        </div>
      </Space>

      <Card title="资源总览" style={{ marginTop: 12 }}>
        <Table<Resource>
          rowKey="id"
          dataSource={resources}
          columns={[
            { title: '资源名称', dataIndex: 'resource_name' },
            { title: '类型', dataIndex: 'resource_type' },
            { title: 'POI', dataIndex: 'poi_id', render: (v: string) => poiList.find((p) => p.id === v)?.poi_name ?? v },
            {
              title: '供应商数',
              render: (_, record) => supplierResources.filter((sr) => sr.resource_id === record.id).length,
            },
            { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag status={v} /> },
          ]}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Drawer
        title={selectedPoi?.poi_name}
        open={!!selectedPoi}
        width={560}
        onClose={() => setSelectedPoi(null)}
        extra={<StatusTag status={selectedPoi?.status ?? ''} />}
      >
        {selectedPoi && (
          <>
            <Card size="small" title="编辑 POI" style={{ marginBottom: 12 }}>
              <Form layout="vertical" form={poiEditForm} onFinish={savePoi}>
                <Form.Item name="poi_name" label="名称" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="poi_type" label="类型">
                  <Select options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))} allowClear />
                </Form.Item>
                <Form.Item name="tags" label="标签（逗号分隔）">
                  <Input />
                </Form.Item>
                <Button type="primary" htmlType="submit" block>
                  保存 POI
                </Button>
              </Form>
            </Card>

            <Divider />
            <List
              header="资源列表"
              dataSource={resources.filter((r) => r.poi_id === selectedPoi.id)}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="edit"
                      type="link"
                      size="small"
                      onClick={() => {
                        setResourceEditing(item)
                        resourceEditForm.setFieldsValue({
                          resource_name: item.resource_name,
                          resource_type: item.resource_type,
                        })
                      }}
                    >
                      编辑
                    </Button>,
                  ]}
                >
                  <List.Item.Meta title={item.resource_name} description={item.resource_type} />
                  <StatusTag status={item.status} />
                </List.Item>
              )}
            />
          </>
        )}
      </Drawer>

      <Modal
        title="编辑资源"
        open={!!resourceEditing}
        onCancel={() => setResourceEditing(null)}
        onOk={() => resourceEditForm.submit()}
      >
        <Form
          layout="vertical"
          form={resourceEditForm}
          onFinish={(values) => {
            if (!resourceEditing) return
            const next: Resource = { ...resourceEditing, resource_name: values.resource_name, resource_type: values.resource_type }
            updateData(
              'resources',
              resources.map((r) => (r.id === resourceEditing.id ? next : r)),
            )
            message.success('资源已保存')
            setResourceEditing(null)
          }}
        >
          <Form.Item name="resource_name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="resource_type" label="类型" rules={[{ required: true }]}>
            <Select options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
