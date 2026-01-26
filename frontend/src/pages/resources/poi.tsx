import { useState, useMemo, useEffect } from 'react'
import { Button, Form, Input, Select, Table, Drawer, Modal, Space, Statistic, message, Card, Row, Col, Popconfirm, Tooltip, Divider, Switch, InputNumber, Tag } from 'antd'
import { EditOutlined, SearchOutlined, DeleteOutlined, SettingOutlined, PlusOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import type { POI } from '@/types'
import { apiRequest } from '@/lib/api'
import TicketPoiFields from '@/components/TicketPoiFields'
import HotelPoiFields from '@/components/HotelPoiFields'
import DiningPoiFields from '@/components/DiningPoiFields'
import TransportPoiFields from '@/components/TransportPoiFields'
import TicketResourceFields from '@/components/TicketResourceFields'
import HotelResourceFields from '@/components/HotelResourceFields'
import DiningResourceFields from '@/components/DiningResourceFields'
import TransportResourceFields from '@/components/TransportResourceFields'
import ResourceManager from '@/components/ResourceManager'
import ContactTableEditor from '@/components/ContactTableEditor'

const POI_TYPES = ['门票', '酒店', '餐饮', '交通'] // POI类型（不含组合）

interface FilterState {
    keyword: string
    city: string | null
}

interface RegionOption {
    code: string
    name: string
    province_code?: string
    city_code?: string
}

export default function ResourcePage() {
    const { data, refresh } = useData()
    const [poiForm] = Form.useForm()
    const [poiEditForm] = Form.useForm()
    const [batchUpdateForm] = Form.useForm()
    const [selectedPoi, setSelectedPoi] = useState<POI | null>(null)
    const [searchParams] = useSearchParams()
    const [detailAutoOpened, setDetailAutoOpened] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
    const [createModalVisible, setCreateModalVisible] = useState(false) // 新建POI Modal
    const [poiType, setPoiType] = useState<string | null>(null) // 新建POI时选择的类型
    const [createResourceEnabled, setCreateResourceEnabled] = useState(false)
    const [createdPoi, setCreatedPoi] = useState<POI | null>(null)
    const [creatingPoi, setCreatingPoi] = useState(false)
    const [resourceStatuses, setResourceStatuses] = useState<Record<number, { saving?: boolean; saved?: boolean }>>({})
    const [provinceOptions, setProvinceOptions] = useState<RegionOption[]>([])
    const [createCityOptions, setCreateCityOptions] = useState<RegionOption[]>([])
    const [createDistrictOptions, setCreateDistrictOptions] = useState<RegionOption[]>([])
    const [editCityOptions, setEditCityOptions] = useState<RegionOption[]>([])
    const [editDistrictOptions, setEditDistrictOptions] = useState<RegionOption[]>([])
    const createProvince = Form.useWatch('province', poiForm)
    const createCity = Form.useWatch('city', poiForm)
    const editProvince = Form.useWatch('province', poiEditForm)
    const editCity = Form.useWatch('city', poiEditForm)

    // 筛选器状态
    const [filters, setFilters] = useState<FilterState>({
        keyword: '',
        city: null,
    })

    useEffect(() => {
        if (!createResourceEnabled || !poiType) return
        const currentResources = poiForm.getFieldValue('resources') || []
        if (currentResources.length === 0) {
            poiForm.setFieldValue('resources', [
                {
                    resource_type: poiType,
                    supplier_bindings: [],
                },
            ])
            return
        }
        const nextResources = currentResources.map((resource: any) => ({
            ...resource,
            resource_type: poiType,
            attrs: resource.resource_type === poiType ? resource.attrs : undefined,
        }))
        poiForm.setFieldValue('resources', nextResources)
    }, [createResourceEnabled, poiType, poiForm])

    useEffect(() => {
        const fetchProvinces = async () => {
            try {
                const data = await apiRequest<RegionOption[]>('/api/regions/provinces')
                setProvinceOptions(data)
            } catch (err: any) {
                message.error(err.message || '省份数据加载失败')
            }
        }
        fetchProvinces()
    }, [])

    const loadCities = async (provinceCode: string, mode: 'create' | 'edit') => {
        if (!provinceCode) {
            if (mode === 'create') {
                setCreateCityOptions([])
                setCreateDistrictOptions([])
            } else {
                setEditCityOptions([])
                setEditDistrictOptions([])
            }
            return []
        }
        try {
            const data = await apiRequest<RegionOption[]>(`/api/regions/cities?province_code=${provinceCode}`)
            if (mode === 'create') {
                setCreateCityOptions(data)
            } else {
                setEditCityOptions(data)
            }
            return data
        } catch (err: any) {
            message.error(err.message || '城市数据加载失败')
            return []
        }
    }

    const loadDistricts = async (cityCode: string, mode: 'create' | 'edit') => {
        if (!cityCode) {
            if (mode === 'create') {
                setCreateDistrictOptions([])
            } else {
                setEditDistrictOptions([])
            }
            return []
        }
        try {
            const data = await apiRequest<RegionOption[]>(`/api/regions/districts?city_code=${cityCode}`)
            if (mode === 'create') {
                setCreateDistrictOptions(data)
            } else {
                setEditDistrictOptions(data)
            }
            return data
        } catch (err: any) {
            message.error(err.message || '区县数据加载失败')
            return []
        }
    }

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
                            查看
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

    const resetCreateModal = () => {
        setCreateModalVisible(false)
        poiForm.resetFields()
        setPoiType(null)
        setCreateResourceEnabled(false)
        setCreatedPoi(null)
        setResourceStatuses({})
        setCreatingPoi(false)
        setCreateCityOptions([])
        setCreateDistrictOptions([])
    }

    const updateResourceStatus = (key: number, next: { saving?: boolean; saved?: boolean }) => {
        setResourceStatuses((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                ...next,
            },
        }))
    }

    const createPoi = async () => {
        setCreatingPoi(true)
        try {
            await poiForm.validateFields(['poi_name', 'poi_type', 'province', 'city', 'district', 'address', 'attrs'])
            const { resources: _resources, ...rawPayload } = poiForm.getFieldsValue(true)
            const provinceName = provinceOptions.find((p) => p.code === rawPayload.province)?.name
            const cityName = createCityOptions.find((c) => c.code === rawPayload.city)?.name
            const districtName = createDistrictOptions.find((d) => d.code === rawPayload.district)?.name
            if (!provinceName || !cityName || !districtName) {
                message.error('省市区信息不完整，请重新选择')
                return null
            }
            const poiPayload = {
                ...rawPayload,
                province: provinceName,
                city: cityName,
                district: districtName,
            }
            const newPoi = await apiRequest<POI>('/api/poi', { method: 'POST', body: JSON.stringify(poiPayload) })
            setCreatedPoi(newPoi)
            await refresh()
            return newPoi
        } catch (err: any) {
            if (!err?.errorFields) {
                message.error(err.message || '创建失败')
            }
            return null
        } finally {
            setCreatingPoi(false)
        }
    }

    const ensureCreatedPoi = async () => {
        if (createdPoi) return createdPoi
        return await createPoi()
    }

    const handleCreatePoi = async () => {
        if (createdPoi) {
            resetCreateModal()
            return
        }
        const newPoi = await createPoi()
        if (!newPoi) return
        if (createResourceEnabled) {
            message.success('POI 已创建，请逐条保存资源')
        } else {
            message.success('POI 已创建')
            resetCreateModal()
        }
    }

    const handleSaveResource = async (resourceIndex: number, fieldKey: number) => {
        if (resourceStatuses[fieldKey]?.saving) return
        updateResourceStatus(fieldKey, { saving: true })
        try {
            await poiForm.validateFields([
                ['resources', resourceIndex, 'resource_name'],
                ['resources', resourceIndex, 'resource_type'],
                ['resources', resourceIndex, 'attrs'],
                ['resources', resourceIndex, 'supplier_bindings'],
            ])

            const hadPoi = !!createdPoi
            const targetPoi = await ensureCreatedPoi()
            if (!targetPoi) return

            const resource = poiForm.getFieldValue(['resources', resourceIndex]) || {}
            const resourceId = resource.id || resource.resource_id
            const resourcePayload: any = {
                poi_id: targetPoi.id,
                resource_name: resource.resource_name,
                resource_type: targetPoi.poi_type || poiType,
                status: 'active',
            }
            if (resource.attrs) {
                resourcePayload.attrs = resource.attrs
            }
            if (resourceId) {
                await apiRequest(`/api/resources/${resourceId}`, {
                    method: 'PUT',
                    body: JSON.stringify(resourcePayload),
                })

                const existingBindings = supplierResources.filter(
                    (sr) => Number(sr.resource_id) === Number(resourceId)
                )
                const newBindings = resource.supplier_bindings || []

                for (const existing of existingBindings) {
                    const stillExists = newBindings.some((nb: any) =>
                        Number(nb.supplier_id) === Number(existing.supplier_id)
                    )
                    if (!stillExists) {
                        await apiRequest(`/api/supplier-resources/${existing.id}`, {
                            method: 'DELETE'
                        })
                    }
                }

                for (const binding of newBindings) {
                    const existingBinding = existingBindings.find(
                        (eb) => Number(eb.supplier_id) === Number(binding.supplier_id)
                    )
                    if (existingBinding) {
                        if (Number(existingBinding.settlement_price) !== Number(binding.settlement_price)) {
                            await apiRequest(`/api/supplier-resources/${existingBinding.id}/adjust-price`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    settlement_price: binding.settlement_price,
                                    reason: '新建POI时资源编辑修改结算价',
                                })
                            })
                        }
                    } else {
                        await apiRequest('/api/supplier-resources', {
                            method: 'POST',
                            body: JSON.stringify({
                                supplier_id: binding.supplier_id,
                                resource_id: resourceId,
                                settlement_price: binding.settlement_price,
                                supply_status: 'active',
                            })
                        })
                    }
                }

                message.success('资源已更新')
            } else {
                const newResource = await apiRequest<{ id: string }>('/api/resources', {
                    method: 'POST',
                    body: JSON.stringify(resourcePayload),
                })

                for (const binding of resource.supplier_bindings || []) {
                    const bindingPayload = {
                        supplier_id: binding.supplier_id,
                        resource_id: newResource.id,
                        settlement_price: binding.settlement_price,
                        supply_status: 'active',
                    }
                    await apiRequest('/api/supplier-resources', {
                        method: 'POST',
                        body: JSON.stringify(bindingPayload),
                    })
                }

                poiForm.setFieldValue(['resources', resourceIndex, 'id'], newResource.id)
                message.success(hadPoi ? '资源已保存' : 'POI 已创建，资源已保存')
            }

            updateResourceStatus(fieldKey, { saved: true })
            await refresh()
        } catch (err: any) {
            if (!err?.errorFields) {
                message.error(err.message || '资源保存失败')
            }
        } finally {
            updateResourceStatus(fieldKey, { saving: false })
        }
    }

    const handleRemoveResource = (fieldKey: number, remove: (index: number) => void, index: number) => {
        setResourceStatuses((prev) => {
            const next = { ...prev }
            delete next[fieldKey]
            return next
        })
        remove(index)
    }
    const savePoi = async (values: any) => {
        if (!selectedPoi) return
        try {
            const provinceName = provinceOptions.find((p) => p.code === values.province)?.name
            const cityName = editCityOptions.find((c) => c.code === values.city)?.name
            const districtName = editDistrictOptions.find((d) => d.code === values.district)?.name
            if (!provinceName || !cityName || !districtName) {
                message.error('省市区信息不完整，请重新选择')
                return
            }
            const payload = {
                ...values,
                province: provinceName,
                city: cityName,
                district: districtName,
            }
            const attrsChanged = JSON.stringify(selectedPoi.attrs || {}) !== JSON.stringify(values.attrs || {})
            if (
                selectedPoi.poi_name === payload.poi_name &&
                (selectedPoi.province || '') === (payload.province || '') &&
                selectedPoi.city === payload.city &&
                (selectedPoi.district || '') === (payload.district || '') &&
                selectedPoi.address === payload.address &&
                (selectedPoi.longitude ?? null) === (payload.longitude ?? null) &&
                (selectedPoi.latitude ?? null) === (payload.latitude ?? null) &&
                !attrsChanged
            ) {
                message.info('没有变更，无需保存')
                setSelectedPoi(null)
                return
            }
            await apiRequest(`/api/poi/${selectedPoi.id}`, { method: 'PUT', body: JSON.stringify(payload) })
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
        const cityCode = poiForm.getFieldValue('city')
        const cityName = createCityOptions.find((c) => c.code === cityCode)?.name
        if (!name || !cityName) return []
        return poiList.filter((poi) => poi.poi_name === name && poi.city === cityName)
    }, [poiForm, poiList, createCityOptions])

    useEffect(() => {
        if (searchParams.get('detail') && !detailAutoOpened && poiList.length) {
            setSelectedPoi(poiList[0])
            setDetailAutoOpened(true)
        }
    }, [searchParams, poiList, detailAutoOpened])

    useEffect(() => {
        if (!selectedPoi) {
            setEditCityOptions([])
            setEditDistrictOptions([])
            return
        }
        const attrs = selectedPoi.attrs || {}
        poiEditForm.setFieldsValue({
            poi_name: selectedPoi.poi_name,
            poi_type: selectedPoi.poi_type,
            address: selectedPoi.address,
            longitude: selectedPoi.longitude,
            latitude: selectedPoi.latitude,
            attrs,
        })
    }, [selectedPoi, poiEditForm])

    useEffect(() => {
        if (!selectedPoi || provinceOptions.length === 0) return
        const attrs = selectedPoi.attrs || {}
        const provinceName = selectedPoi.province || attrs.province
        const districtName = selectedPoi.district || attrs.district
        const provinceCode = provinceOptions.find((p) => p.name === provinceName)?.code
        if (!provinceCode) return
        poiEditForm.setFieldValue('province', provinceCode)
        loadCities(provinceCode, 'edit').then((cities) => {
            const cityCode = cities.find((c) => c.name === selectedPoi.city)?.code
            if (!cityCode) {
                setEditDistrictOptions([])
                return
            }
            poiEditForm.setFieldValue('city', cityCode)
            loadDistricts(cityCode, 'edit').then((districts) => {
                const districtCode = districts.find((d) => d.name === districtName)?.code
                if (districtCode) {
                    poiEditForm.setFieldValue('district', districtCode)
                }
            })
        })
    }, [selectedPoi, provinceOptions])

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">POI 管理</h1>
                <p className="page-subtitle">管理所有 POI 及其资源，点击查看进入资源列表与创建</p>
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
                    resetCreateModal()
                }}
                footer={null}
                width={1100}
                style={{ top: 20 }}
            >
                <Form
                    layout="vertical"
                    form={poiForm}
                    initialValues={{ attrs: { business_contacts: [{}] } }}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="poi_name" label="POI 名称" rules={[{ required: true, message: '请输入POI名称' }]}>
                                <Input placeholder="如：丽江古城" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="poi_type" label="POI 类型" rules={[{ required: true, message: '请选择POI类型' }]}>
                                <Select
                                    placeholder="选择POI类型（必选）"
                                    disabled={!!createdPoi}
                                    onChange={(value) => {
                                        setPoiType(value)
                                        const contacts = poiForm.getFieldValue(['attrs', 'business_contacts'])
                                        poiForm.setFieldsValue({ attrs: { business_contacts: contacts } })
                                    }}
                                >
                                    {POI_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item
                                name="province"
                                label="省份"
                                rules={[{ required: true, message: '请选择省份' }]}
                            >
                                <Select
                                    placeholder="选择省份"
                                    showSearch
                                    optionFilterProp="label"
                                    options={provinceOptions.map((p) => ({ value: p.code, label: p.name }))}
                                    onChange={(value) => {
                                        poiForm.setFieldsValue({ city: undefined, district: undefined })
                                        setCreateCityOptions([])
                                        setCreateDistrictOptions([])
                                        loadCities(value, 'create')
                                    }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="city"
                                label="城市"
                                rules={[{ required: true, message: '请选择城市' }]}
                            >
                                <Select
                                    placeholder="选择城市"
                                    showSearch
                                    optionFilterProp="label"
                                    disabled={!createProvince}
                                    options={createCityOptions.map((c) => ({ value: c.code, label: c.name }))}
                                    onChange={(value) => {
                                        poiForm.setFieldValue('district', undefined)
                                        setCreateDistrictOptions([])
                                        loadDistricts(value, 'create')
                                    }}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item
                                name="district"
                                label="区/县"
                                rules={[{ required: true, message: '请选择区/县' }]}
                            >
                                <Select
                                    placeholder="选择区/县"
                                    showSearch
                                    optionFilterProp="label"
                                    disabled={!createCity}
                                    options={createDistrictOptions.map((d) => ({ value: d.code, label: d.name }))}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="address" label="地址">
                        <Input placeholder="详细地址" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="longitude" label="经度">
                                <InputNumber
                                    placeholder="例如 116.397128"
                                    style={{ width: '100%' }}
                                    step={0.000001}
                                    precision={6}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="latitude" label="纬度">
                                <InputNumber
                                    placeholder="例如 39.916527"
                                    style={{ width: '100%' }}
                                    step={0.000001}
                                    precision={6}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {suggestions.length > 0 && (
                        <div style={{ padding: 8, background: '#fff3cd', borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
                            ⚠️ 检测到同名同城的POI ({suggestions.length}个)，请确认是否重复
                        </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
                        <h4 style={{ marginBottom: 12 }}>业务对接人信息</h4>
                        <ContactTableEditor
                            name={['attrs', 'business_contacts']}
                            showRemark
                            addLabel="添加对接人"
                            emptyText="暂无对接人信息，点击下方按钮添加"
                        />
                    </div>

                    {/* 根据POI类型显示对应的通用字段 */}
                    {poiType === '门票' && <TicketPoiFields />}
                    {poiType === '酒店' && <HotelPoiFields />}
                    {poiType === '餐饮' && <DiningPoiFields />}
                    {poiType === '交通' && <TransportPoiFields />}

                    <Divider style={{ margin: '16px 0' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <Switch
                            disabled={!poiType || !!createdPoi}
                            checked={createResourceEnabled}
                            onChange={(checked) => {
                                setCreateResourceEnabled(checked)
                                if (!checked) {
                                    poiForm.setFieldValue('resources', undefined)
                                    setResourceStatuses({})
                                    return
                                }
                                if (poiType) {
                                    poiForm.setFieldValue('resources', [
                                        {
                                            resource_type: poiType,
                                            supplier_bindings: [],
                                        },
                                    ])
                                }
                            }}
                        />
                        <span style={{ fontWeight: 600 }}>同时创建资源</span>
                        <span style={{ fontSize: 12, color: '#888' }}>可选</span>
                    </div>
                    {createResourceEnabled && poiType && (
                        <div style={{ marginBottom: 16 }}>
                            <Form.List name="resources">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map((field, index) => {
                                            const status = resourceStatuses[field.key]
                                            return (
                                                <div key={field.key} style={{ marginBottom: 16, padding: 16, background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                        <Space size={8}>
                                                            <span style={{ fontWeight: 600 }}>资源 {index + 1}</span>
                                                            {status?.saved && (
                                                                <Tooltip title="可继续编辑后再次保存">
                                                                    <Tag color="green">已保存</Tag>
                                                                </Tooltip>
                                                            )}
                                                        </Space>
                                                        <Space>
                                                            <Button
                                                                type="primary"
                                                                size="small"
                                                                onClick={() => handleSaveResource(field.name, field.key)}
                                                                loading={status?.saving}
                                                                disabled={status?.saving}
                                                            >
                                                                保存资源
                                                            </Button>
                                                            {fields.length > 1 && (status?.saved ? (
                                                                <Tooltip title="已保存的资源请在详情页删除">
                                                                    <Button size="small" danger disabled>
                                                                        删除
                                                                    </Button>
                                                                </Tooltip>
                                                            ) : (
                                                                <Button size="small" danger onClick={() => handleRemoveResource(field.key, remove, field.name)}>
                                                                    删除
                                                                </Button>
                                                            ))}
                                                        </Space>
                                                    </div>

                                                    <Row gutter={16}>
                                                        <Col span={14}>
                                                            <Row gutter={16}>
                                                                <Col span={12}>
                                                                    <Form.Item name={[field.name, 'resource_name']} label="资源名称" rules={[{ required: true, message: '请输入资源名称' }]}>
                                                                        <Input placeholder="例如：标准双床房" />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col span={12}>
                                                                    <Form.Item name={[field.name, 'resource_type']} label="资源类型" rules={[{ required: true, message: '请选择资源类型' }]}>
                                                                        <Select
                                                                            placeholder="资源类型"
                                                                            disabled
                                                                            options={poiType ? [{ value: poiType, label: poiType }] : []}
                                                                        />
                                                                    </Form.Item>
                                                                </Col>
                                                            </Row>

                                                            {poiType === '门票' && <TicketResourceFields prefix={[field.name, 'attrs']} />}
                                                            {poiType === '酒店' && <HotelResourceFields prefix={[field.name, 'attrs']} />}
                                                            {poiType === '餐饮' && <DiningResourceFields prefix={[field.name, 'attrs']} />}
                                                            {poiType === '交通' && <TransportResourceFields prefix={[field.name, 'attrs']} />}
                                                        </Col>
                                                        <Col span={10}>
                                                            <div style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                                                <h4 style={{ marginBottom: 8 }}>供应商绑定（可选）</h4>
                                                                <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                                                                    可先创建资源，再视需要绑定供应商，绑定后可设置结算价。
                                                                </p>
                                                                <Form.List name={[field.name, 'supplier_bindings']}>
                                                                    {(supplierFields, { add: addSupplier, remove: removeSupplier }, { errors }) => (
                                                                        <>
                                                                            {supplierFields.map(({ key, name, ...restField }) => (
                                                                                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                                                                    <Form.Item
                                                                                        {...restField}
                                                                                        name={[name, 'supplier_id']}
                                                                                        rules={[{ required: true, message: '请选择供应商' }]}
                                                                                        style={{ marginBottom: 0, width: 180 }}
                                                                                    >
                                                                                        <Select
                                                                                            placeholder="选择供应商"
                                                                                            showSearch
                                                                                            optionFilterProp="label"
                                                                                            options={suppliers.map((s) => ({ value: s.id, label: s.supplier_name }))}
                                                                                        />
                                                                                    </Form.Item>
                                                                                    <Form.Item
                                                                                        {...restField}
                                                                                        name={[name, 'settlement_price']}
                                                                                        rules={[{ required: true, message: '请输入结算价' }]}
                                                                                        style={{ marginBottom: 0, width: 120 }}
                                                                                    >
                                                                                        <InputNumber placeholder="结算价" min={0} style={{ width: '100%' }} prefix="¥" />
                                                                                    </Form.Item>
                                                                                    <Button type="link" danger onClick={() => removeSupplier(name)}>
                                                                                        删除
                                                                                    </Button>
                                                                                </Space>
                                                                            ))}
                                                                            <Form.Item style={{ marginBottom: 0 }}>
                                                                                <Button type="dashed" onClick={() => addSupplier()} block icon={<PlusOutlined />}>
                                                                                    添加供应商
                                                                                </Button>
                                                                                <Form.ErrorList errors={errors} />
                                                                            </Form.Item>
                                                                        </>
                                                                    )}
                                                                </Form.List>
                                                            </div>
                                                        </Col>
                                                    </Row>
                                                </div>
                                            )
                                        })}
                                        <Button
                                            type="dashed"
                                            onClick={() => add({ resource_type: poiType, supplier_bindings: [] })}
                                            block
                                            icon={<PlusOutlined />}
                                        >
                                            增加一个资源
                                        </Button>
                                    </>
                                )}
                            </Form.List>
                        </div>
                    )}

                    <div style={{ marginTop: 24, padding: 12, background: '#e6f7ff', borderRadius: 4, fontSize: 12, marginBottom: 16 }}>
                        💡 提示：资源需要逐条点击“保存资源”，未保存的不会创建。也可以先保存 POI，稍后在详情里添加资源。
                    </div>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => {
                                resetCreateModal()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" onClick={handleCreatePoi} loading={creatingPoi}>
                                {createdPoi ? '完成' : '创建 POI'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* POI 详情 Drawer */}
            <Drawer
                title={`POI 详情: ${selectedPoi?.poi_name}`}
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
                                        <Form.Item
                                            name="province"
                                            label="省份"
                                            rules={[{ required: true, message: '请选择省份' }]}
                                        >
                                            <Select
                                                placeholder="选择省份"
                                                showSearch
                                                optionFilterProp="label"
                                                options={provinceOptions.map((p) => ({ value: p.code, label: p.name }))}
                                                onChange={(value) => {
                                                    poiEditForm.setFieldsValue({ city: undefined, district: undefined })
                                                    setEditCityOptions([])
                                                    setEditDistrictOptions([])
                                                    loadCities(value, 'edit')
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="city"
                                            label="城市"
                                            rules={[{ required: true, message: '请选择城市' }]}
                                        >
                                            <Select
                                                placeholder="选择城市"
                                                showSearch
                                                optionFilterProp="label"
                                                disabled={!editProvince}
                                                options={editCityOptions.map((c) => ({ value: c.code, label: c.name }))}
                                                onChange={(value) => {
                                                    poiEditForm.setFieldValue('district', undefined)
                                                    setEditDistrictOptions([])
                                                    loadDistricts(value, 'edit')
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="district"
                                            label="区/县"
                                            rules={[{ required: true, message: '请选择区/县' }]}
                                        >
                                            <Select
                                                placeholder="选择区/县"
                                                showSearch
                                                optionFilterProp="label"
                                                disabled={!editCity}
                                                options={editDistrictOptions.map((d) => ({ value: d.code, label: d.name }))}
                                            />
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
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item name="longitude" label="经度">
                                            <InputNumber
                                                placeholder="例如 116.397128"
                                                style={{ width: '100%' }}
                                                step={0.000001}
                                                precision={6}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name="latitude" label="纬度">
                                            <InputNumber
                                                placeholder="例如 39.916527"
                                                style={{ width: '100%' }}
                                                step={0.000001}
                                                precision={6}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <div style={{ marginBottom: 16 }}>
                                    <h4 style={{ marginBottom: 12 }}>业务对接人信息</h4>
                                    <ContactTableEditor
                                        name={['attrs', 'business_contacts']}
                                        showRemark
                                        addLabel="添加对接人"
                                        emptyText="暂无对接人信息，点击下方按钮添加"
                                    />
                                </div>

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

                        <Divider style={{ margin: '16px 0' }} />
                        <ResourceManager key={selectedPoi.id} poiId={selectedPoi.id} mode="embedded" />
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

        </div>
    )
}
