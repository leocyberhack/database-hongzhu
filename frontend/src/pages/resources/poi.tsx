import { useState, useMemo, useEffect } from 'react'
import { Button, Form, Input, Select, Table, Drawer, Modal, List, Space, Statistic, Tag, message, Card, Row, Col, Popconfirm, Tooltip } from 'antd'
import { EditOutlined, SearchOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import type { POI, Resource } from '@/types'
import { apiRequest } from '@/lib/api'
import TicketPoiFields from '@/components/TicketPoiFields'
import HotelPoiFields from '@/components/HotelPoiFields'
import DiningPoiFields from '@/components/DiningPoiFields'
import TransportPoiFields from '@/components/TransportPoiFields'

const POI_TYPES = ['门票', '酒店', '餐饮', '交通'] // POI类型（不含组合）
const RESOURCE_TYPES = ['门票', '酒店', '交通', '餐饮']

interface FilterState {
    keyword: string
    city: string | null
}

export default function ResourcePage() {
    const { data, refresh } = useData()
    const [poiForm] = Form.useForm()
    const [poiEditForm] = Form.useForm()
    const [resourceEditForm] = Form.useForm()
    const [batchUpdateForm] = Form.useForm()
    const [selectedPoi, setSelectedPoi] = useState<POI | null>(null)
    const [resourceEditing, setResourceEditing] = useState<Resource | null>(null)
    const [searchParams] = useSearchParams()
    const [detailAutoOpened, setDetailAutoOpened] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
    const [createModalVisible, setCreateModalVisible] = useState(false) // 新建POI Modal
    const [poiType, setPoiType] = useState<string | null>(null) // 新建POI时选择的类型

    // 筛选器状态
    const [filters, setFilters] = useState<FilterState>({
        keyword: '',
        city: null,
    })

    // 监听选中POI变化，填充表单
    useEffect(() => {
        if (selectedPoi) {
            const attrs = selectedPoi.attrs || {}
            // 确保attrs字段存在，避免undefined问题
            const initialValues = {
                ...selectedPoi,
                province: selectedPoi.province || attrs.province,
                district: selectedPoi.district || attrs.district,
                attrs
            }
            poiEditForm.setFieldsValue(initialValues)
        }
    }, [selectedPoi, poiEditForm])

    const poiList = data?.poi ?? []
    const resources = data?.resources ?? []
    const suppliers = data?.suppliers ?? []
    const supplierResources = data?.supplier_resources ?? []

    // 过滤逻辑
    const filteredPoiList = useMemo(() => {
        return poiList.filter((poi) => {
            // 关键词搜索（名称或地址）
            if (filters.keyword) {
                const kw = filters.keyword.toLowerCase()
                if (!poi.poi_name.toLowerCase().includes(kw) && !poi.address?.toLowerCase().includes(kw)) {
                    return false
                }
            }
            // 城市筛选
            if (filters.city && poi.city !== filters.city) {
                return false
            }
            return true
        })
    }, [poiList, filters])

    // 获取所有城市列表供筛选
    const cities = useMemo(() => {
        return Array.from(new Set(poiList.map(p => p.city))).sort()
    }, [poiList])

    const stats = useMemo(
        () => ({
            poi: poiList.length,
            resources: resources.length,
            suppliers: suppliers.length,
            links: supplierResources.length,
        }),
        [poiList.length, resources.length, suppliers.length, supplierResources.length]
    )

    const columns: any = [
        {
            title: 'POI 名称',
            dataIndex: 'poi_name',
            sorter: (a: POI, b: POI) => a.poi_name.localeCompare(b.poi_name),
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="搜索名称"
                        value={selectedKeys[0]}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{ width: 188, marginBottom: 8, display: 'block' }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() => confirm()}
                            icon={<SearchOutlined />}
                            size="small"
                            style={{ width: 90 }}
                        >
                            搜索
                        </Button>
                        <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
                            重置
                        </Button>
                    </Space>
                </div>
            ),
            filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
            onFilter: (value: string, record: POI) =>
                record.poi_name.toLowerCase().includes(value.toLowerCase()),
        },
        {
            title: '城市',
            dataIndex: 'city',
            sorter: (a: POI, b: POI) => a.city.localeCompare(b.city),
            filters: cities.map(c => ({ text: c, value: c })),
            onFilter: (value: string, record: POI) => record.city === value,
        },
        {
            title: '地址',
            dataIndex: 'address',
            ellipsis: true
        },
        {
            title: '资源数',
            render: (_: any, record: POI) => resources.filter((r) => r.poi_id === record.id).length,
            width: 100,
            sorter: (a: POI, b: POI) => {
                const countA = resources.filter(r => r.poi_id === a.id).length
                const countB = resources.filter(r => r.poi_id === b.id).length
                return countA - countB
            }
        },
        {
            title: '操作',
            width: 150,
            render: (_: any, record: POI) => {
                const resourceCount = resources.filter(r => r.poi_id === record.id).length
                const isLocked = resourceCount > 0

                return (
                    <Space>
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => setSelectedPoi(record)}
                        >
                            编辑
                        </Button>
                        {isLocked ? (
                            <Tooltip title="该POI下已有资源(数量不为0)，不可删除">
                                <Button
                                    type="link"
                                    size="small"
                                    danger
                                    disabled
                                    icon={<DeleteOutlined />}
                                >
                                    删除
                                </Button>
                            </Tooltip>
                        ) : (
                            <Popconfirm
                                title="确定删除该POI吗？"
                                description="删除POI可能影响关联的资源，请谨慎操作"
                                onConfirm={() => deletePoi(record.id)}
                                okText="删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                            >
                                <Button
                                    type="link"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                >
                                    删除
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                )
            },
        },
    ]

    const addPoi = async (values: any) => {
        try {
            await apiRequest('/api/poi', { method: 'POST', body: JSON.stringify(values) })
            message.success('已创建 POI')
            poiForm.resetFields()
            setPoiType(null)
            setCreateModalVisible(false)
            await refresh()
        } catch (err: any) {
            message.error(err.message || '创建失败')
        }
    }

    const savePoi = async (values: any) => {
        if (!selectedPoi) return
        try {
            const attrsChanged = JSON.stringify(selectedPoi.attrs || {}) !== JSON.stringify(values.attrs || {})
            if (
                selectedPoi.poi_name === values.poi_name &&
                (selectedPoi.province || '') === (values.province || '') &&
                selectedPoi.city === values.city &&
                (selectedPoi.district || '') === (values.district || '') &&
                selectedPoi.address === values.address &&
                !attrsChanged
            ) {
                message.info('没有变更，无需保存')
                setSelectedPoi(null)
                return
            }
            await apiRequest(`/api/poi/${selectedPoi.id}`, { method: 'PUT', body: JSON.stringify(values) })
            message.success('POI 已保存')
            setSelectedPoi(null)
            await refresh()
        } catch (err: any) {
            message.error(err.message || '保存失败')
        }
    }

    const deletePoi = async (id: string) => {
        try {
            await apiRequest(`/api/poi/${id}`, { method: 'DELETE' })
            message.success('POI 已删除')
            await refresh()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            await apiRequest('/api/poi/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`已删除 ${selectedRowKeys.length} 个POI`)
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量删除失败')
        }
    }

    const handleBatchUpdate = async (values: any) => {
        if (selectedRowKeys.length === 0) return
        try {
            // Remove empty fields
            const fields: any = {}
            if (values.city) fields.city = values.city

            if (Object.keys(fields).length === 0) {
                message.warning('请至少输入一个要修改的字段')
                return
            }

            await apiRequest('/api/poi/batch-update', {
                method: 'POST',
                body: JSON.stringify({
                    ids: selectedRowKeys,
                    fields
                })
            })
            message.success(`已更新 ${selectedRowKeys.length} 个POI`)
            setBatchUpdateVisible(false)
            batchUpdateForm.resetFields()
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
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
            const attrs = selectedPoi.attrs || {}
            poiEditForm.setFieldsValue({
                poi_name: selectedPoi.poi_name,
                poi_type: selectedPoi.poi_type,
                province: selectedPoi.province || attrs.province,
                city: selectedPoi.city,
                district: selectedPoi.district || attrs.district,
                address: selectedPoi.address,
                attrs,
            })
        }
    }, [selectedPoi, poiEditForm])

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">POI 管理</h1>
                <p className="page-subtitle">管理所有POI（景点/酒店/场所），创建资源请前往"资源管理"</p>
            </div>

            <Space size={12} style={{ width: '100%', marginBottom: 12, display: 'flex' }}>
                <div className="glass-card" style={{ flex: 1, padding: '16px' }}>
                    <Statistic title="POI 总数" value={stats.poi} />
                </div>
                <div className="glass-card" style={{ flex: 1, padding: '16px' }}>
                    <Statistic title="资源数" value={stats.resources} />
                </div>
                <div className="glass-card" style={{ flex: 1, padding: '16px' }}>
                    <Statistic title="供应商数" value={stats.suppliers} />
                </div>
                <div className="glass-card" style={{ flex: 1, padding: '16px' }}>
                    <Statistic title="供应关系" value={stats.links} />
                </div>
            </Space>

            {/* 高级筛选器 */}
            <Card size="small" style={{ marginBottom: 16 }} bodyStyle={{ padding: '16px' }}>
                <Form layout="inline" style={{ width: '100%' }}>
                    <Row gutter={[16, 16]} style={{ width: '100%' }}>
                        <Col span={8}>
                            <Form.Item label="关键词" style={{ marginBottom: 0, width: '100%' }}>
                                <Input
                                    placeholder="搜索POI名称或地址"
                                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                    value={filters.keyword}
                                    onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                                    allowClear
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="城市" style={{ marginBottom: 0, width: '100%' }}>
                                <Select
                                    placeholder="全部城市"
                                    showSearch
                                    allowClear
                                    options={cities.map(c => ({ value: c, label: c }))}
                                    value={filters.city}
                                    onChange={v => setFilters({ ...filters, city: v })}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8} style={{ textAlign: 'right' }}>
                            <Button type="primary" onClick={() => setCreateModalVisible(true)} style={{ marginRight: 8 }}>
                                新建 POI
                            </Button>
                            {selectedRowKeys.length > 0 && (
                                <Space>
                                    <Button onClick={() => setBatchUpdateVisible(true)} icon={<SettingOutlined />}>
                                        批量修改
                                    </Button>
                                    <Popconfirm
                                        title={`确定删除选中的 ${selectedRowKeys.length} 个POI吗？`}
                                        onConfirm={handleBatchDelete}
                                        okText="确定删除"
                                        cancelText="取消"
                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button danger icon={<DeleteOutlined />}>
                                            批量删除
                                        </Button>
                                    </Popconfirm>
                                </Space>
                            )}
                        </Col>
                    </Row>
                </Form>
            </Card>


            {/* POI列表 - 全宽显示 */}
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0 }}>POI 列表</h3>
                    {selectedRowKeys.length > 0 && <span style={{ color: '#666' }}>已选择 {selectedRowKeys.length} 项</span>}
                </div>
                <Table<POI>
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredPoiList}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: filteredPoiList.length,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
                        onShowSizeChange: (current, size) => setPagination({ current, pageSize: size })
                    }}
                    onChange={(p) => setPagination({ current: p.current || 1, pageSize: p.pageSize || 10 })}
                />
            </div>

            {/* 新建POI Modal */}
            <Modal
                title="新建 POI"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false)
                    poiForm.resetFields()
                    setPoiType(null)
                }}
                footer={null}
                width={800}
                style={{ top: 20 }}
            >
                <Form layout="vertical" form={poiForm} onFinish={addPoi}>
                    <Form.Item name="poi_name" label="POI 名称" rules={[{ required: true, message: '请输入POI名称' }]}>
                        <Input placeholder="如：丽江古城" />
                    </Form.Item>

                    <Form.Item name="poi_type" label="POI 类型" rules={[{ required: true, message: '请选择POI类型' }]}>
                        <Select
                            placeholder="选择POI类型（必选）"
                            onChange={(value) => {
                                setPoiType(value)
                                poiForm.setFieldsValue({ attrs: undefined })
                            }}
                        >
                            {POI_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                        </Select>
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="province" label="省份">
                                <Input placeholder="云南" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="city" label="城市" rules={[{ required: true, message: '请输入城市' }]}>
                                <Input placeholder="丽江" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="district" label="区/县">
                                <Input placeholder="古城区" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="address" label="地址">
                        <Input placeholder="详细地址" />
                    </Form.Item>

                    {suggestions.length > 0 && (
                        <div style={{ padding: 8, background: '#fff3cd', borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
                            ⚠️ 检测到同名同城的POI ({suggestions.length}个)，请确认是否重复
                        </div>
                    )}

                    {/* 根据POI类型显示对应的通用字段 */}
                    {poiType === '门票' && <TicketPoiFields />}
                    {poiType === '酒店' && <HotelPoiFields />}
                    {poiType === '餐饮' && <DiningPoiFields />}
                    {poiType === '交通' && <TransportPoiFields />}

                    <div style={{ marginTop: 24, padding: 12, background: '#e6f7ff', borderRadius: 4, fontSize: 12, marginBottom: 16 }}>
                        💡 提示：创建POI后，前往"资源管理"页面创建具体的资源（门票、酒店房型等）并绑定供应商
                    </div>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => {
                                setCreateModalVisible(false)
                                poiForm.resetFields()
                                setPoiType(null)
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                创建 POI
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* POI 编辑 Drawer */}
            <Drawer
                title={`编辑 POI: ${selectedPoi?.poi_name}`}
                open={!!selectedPoi}
                width={560}
                onClose={() => setSelectedPoi(null)}
            >
                {selectedPoi && (
                    <>
                        <div className="glass-card" style={{ padding: '16px', marginBottom: 12 }}>
                            <h4 style={{ marginBottom: '12px' }}>基本信息</h4>
                            <Form layout="vertical" form={poiEditForm} onFinish={savePoi}>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="poi_name" label="名称" rules={[{ required: true }]}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="poi_type" label="类型">
                                            <Select disabled>
                                                {POI_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Form.Item name="province" label="省份">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="city" label="城市" rules={[{ required: true }]}>
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="district" label="区/县">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={24}>
                                        <Form.Item name="address" label="地址">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                {/* 动态字段编辑区域 */}
                                {selectedPoi.poi_type === '门票' && <TicketPoiFields />}
                                {selectedPoi.poi_type === '酒店' && <HotelPoiFields />}
                                {selectedPoi.poi_type === '餐饮' && <DiningPoiFields />}
                                {selectedPoi.poi_type === '交通' && <TransportPoiFields />}

                                <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
                                    <Button onClick={() => setSelectedPoi(null)}>取消</Button>
                                    <Button type="primary" htmlType="submit">
                                        保存
                                    </Button>
                                </Space>
                            </Form>
                        </div>

                        <h4 style={{ marginBottom: 12 }}>关联的资源（共{resources.filter((r) => r.poi_id === selectedPoi.id).length}个）</h4>
                        <List
                            dataSource={resources.filter((r) => r.poi_id === selectedPoi.id)}
                            locale={{ emptyText: '该POI暂无资源，请前往"资源管理"创建' }}
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
                                    <List.Item.Meta
                                        title={item.resource_name}
                                        description={
                                            <Space>
                                                <Tag>{item.resource_type}</Tag>
                                                <span style={{ fontSize: 12, color: '#999' }}>
                                                    {supplierResources.filter((sr) => sr.resource_id === item.id).length} 个供应商
                                                </span>
                                            </Space>
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    </>
                )}
            </Drawer>

            {/* 批量更新 Modal */}
            <Modal
                title={`批量修改已选的 ${selectedRowKeys.length} 个POI`}
                open={batchUpdateVisible}
                onCancel={() => setBatchUpdateVisible(false)}
                footer={null}
            >
                <Form layout="vertical" form={batchUpdateForm} onFinish={handleBatchUpdate}>
                    <p style={{ color: '#999', marginBottom: 16 }}>
                        请填写需要修改的字段，留空则不修改
                    </p>
                    <Form.Item name="city" label="城市">
                        <Input placeholder="批量修改城市" />
                    </Form.Item>
                    <Space style={{ float: 'right', marginTop: 16 }}>
                        <Button onClick={() => setBatchUpdateVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">
                            确认修改
                        </Button>
                    </Space>
                </Form>
            </Modal>

            {/* 资源编辑 Modal */}
            <Modal
                title="编辑资源"
                open={!!resourceEditing}
                onCancel={() => setResourceEditing(null)}
                onOk={() => resourceEditForm.submit()}
            >
                <Form
                    layout="vertical"
                    form={resourceEditForm}
                    onFinish={async (values) => {
                        if (!resourceEditing) return
                        try {
                            await apiRequest(`/api/resources/${resourceEditing.id}`, { method: 'PUT', body: JSON.stringify(values) })
                            message.success('资源已保存')
                            await refresh()
                            setResourceEditing(null)
                        } catch (err: any) {
                            message.error(err.message || '保存失败')
                        }
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
