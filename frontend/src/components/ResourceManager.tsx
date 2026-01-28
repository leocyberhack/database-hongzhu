import { useState, useMemo, useRef, useEffect } from 'react'
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, Tag, Drawer, Descriptions, Card, Checkbox, Row, Col, Popconfirm, Tooltip } from 'antd'
import { CalendarOutlined, PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import { useData } from '@/contexts/DataContext'
import { apiRequest } from '@/lib/api'
import type { Resource } from '@/types'
import SKUCalendarEditor from '@/components/SKUCalendarEditor'
import type { SKUCalendarEditorRef } from '@/components/SKUCalendarEditor'
import TicketResourceFields from '@/components/TicketResourceFields'
import HotelResourceFields from '@/components/HotelResourceFields'
import DiningResourceFields from '@/components/DiningResourceFields'
import TransportResourceFields from '@/components/TransportResourceFields'
import AgreementModal from './AgreementModal'
import PresetAgreementEditor from './PresetAgreementEditor'



const RESOURCE_TYPES = ['酒店', '景区', '餐饮', '交通']

interface FilterState {
    keyword: string
    types: string[]
    poi_id: string | number | null
    status: string | null
}

interface ResourceManagerProps {
    poiId?: string | number
    mode?: 'page' | 'embedded'
    typeOptions?: Record<string, string[]>
    onOptionsChange?: (field: string, newOptions: string[]) => void
    onOptionAdd?: (field: string, val: string) => void
    onOptionDelete?: (field: string, val: string) => void
    onOptionRename?: (field: string, oldVal: string, newVal: string) => void
}

export default function ResourceManager({
    poiId,
    mode = 'page',
    typeOptions,
    onOptionsChange,
    onOptionAdd,
    onOptionDelete,
    onOptionRename
}: ResourceManagerProps) {
    const { data, refresh } = useData()
    const resources = data?.resources ?? []
    const poiList = data?.poi ?? []
    const suppliers = data?.suppliers ?? []
    const supplierResources = data?.supplier_resources ?? []
    const productResources = data?.product_resources ?? []
    const isEmbedded = mode === 'embedded'
    const [createModalVisible, setCreateModalVisible] = useState(false)
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
    const [viewDrawerVisible, setViewDrawerVisible] = useState(false)
    const [editModalVisible, setEditModalVisible] = useState(false)
    const [inventoryModalVisible, setInventoryModalVisible] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20 })
    const [form] = Form.useForm()
    const [editForm] = Form.useForm()
    const [batchUpdateForm] = Form.useForm()
    const createFormPoiId = Form.useWatch('poi_id', form)
    const editFormPoiId = Form.useWatch('poi_id', editForm)

    const updatePoiOptionsChange = async (targetPoiId: any, field: string, newOptions: string[]) => {
        if (isEmbedded) {
            onOptionsChange?.(field, newOptions)
            return
        }

        const targetPoi = poiList.find((p) => p.id === targetPoiId)
        if (!targetPoi) return

        const newTypeOptions = { ...(targetPoi.type_options || {}), [field]: newOptions }
        try {
            await apiRequest(`/api/poi/${targetPoi.id}`, {
                method: 'PUT',
                body: JSON.stringify({ type_options: newTypeOptions })
            })
            message.success('已更新资源字段选项')
            await refresh()
        } catch {
            message.error('更新资源字段选项失败')
        }
    }

    const updatePoiOptions = async (targetPoiId: any, field: string, action: 'add' | 'delete' | 'rename', val1: string, val2?: string) => {
        if (isEmbedded) {
            if (action === 'add') onOptionAdd?.(field, val1)
            if (action === 'delete') onOptionDelete?.(field, val1)
            if (action === 'rename' && val2) onOptionRename?.(field, val1, val2)
            return
        }

        const targetPoi = poiList.find((p) => p.id === targetPoiId)
        if (!targetPoi) return

        let nextFieldOptions = [...((targetPoi.type_options?.[field] as string[]) || [])]
        if (action === 'add') {
            if (!nextFieldOptions.includes(val1)) nextFieldOptions.push(val1)
        }
        if (action === 'delete') nextFieldOptions = nextFieldOptions.filter((v) => v !== val1)
        if (action === 'rename' && val2) nextFieldOptions = nextFieldOptions.map((v) => (v === val1 ? val2 : v))

        const newTypeOptions = { ...(targetPoi.type_options || {}), [field]: nextFieldOptions }
        try {
            await apiRequest(`/api/poi/${targetPoi.id}`, {
                method: 'PUT',
                body: JSON.stringify({ type_options: newTypeOptions })
            })
            message.success('已更新资源字段选项')
            await refresh()
        } catch {
            message.error('更新资源字段选项失败')
        }
    }

    const getFormOptions = (formPoiId: any) => {
        if (isEmbedded && typeOptions) return typeOptions
        const poi = poiList.find((p) => p.id === formPoiId)
        return (poi?.type_options as Record<string, string[]>) || {}
    }
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | undefined>(undefined)
    const calendarRef = useRef<SKUCalendarEditorRef>(null)
    const fixedPoi = useMemo(
        () => (poiId ? poiList.find((p) => String(p.id) === String(poiId)) : undefined),
        [poiList, poiId]
    )
    const fixedPoiType = fixedPoi?.poi_type

    // 追踪当前选择的资源类型，用于动态显示字段
    const [resourceType, setResourceType] = useState<string | null>(null)
    // 追踪资源类型是否被POI锁定
    const [isTypeLocked, setIsTypeLocked] = useState(false)

    // 筛选器状态
    const [filters, setFilters] = useState<FilterState>({
        keyword: '',
        types: [],
        poi_id: null,
        status: null,
    })

    useEffect(() => {
        if (!poiId) return
        setFilters((prev) => ({
            ...prev,
            poi_id: poiId,
        }))
    }, [poiId])

    // Agreement Modal State
    const [agreementModalState, setAgreementModalState] = useState<{
        visible: boolean
        supplierResourceId: number
        supplierName: string
        supplierFolderId: number | null
    }>({
        visible: false,
        supplierResourceId: 0,
        supplierName: '',
        supplierFolderId: null
    })

    // Pending Agreements for Create Mode
    const [pendingAgreements, setPendingAgreements] = useState<Record<number, any[]>>({})
    const [presetAgreementModal, setPresetAgreementModal] = useState<{
        visible: boolean
        fieldIndex: number
        supplierId: number
        supplierName: string
        supplierFolderId: number | null
    }>({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })

    // 过滤逻辑
    const filteredResources = useMemo(() => {
        const activePoiId = poiId ?? filters.poi_id
        return resources.filter((r) => {
            if (filters.keyword && !r.resource_name.toLowerCase().includes(filters.keyword.toLowerCase())) {
                return false
            }
            if (filters.types.length > 0 && !filters.types.includes(r.resource_type)) {
                return false
            }
            if (activePoiId && String(r.poi_id) !== String(activePoiId)) {
                return false
            }
            if (filters.status && r.status !== filters.status) {
                return false
            }
            return true
        })
    }, [resources, filters, poiId])

    useEffect(() => {
        if (!poiId || !createModalVisible || !fixedPoiType) return
        const shouldLock = RESOURCE_TYPES.includes(fixedPoiType)
        setIsTypeLocked(shouldLock)
        setResourceType(fixedPoiType)
        form.setFieldsValue({
            poi_id: fixedPoi?.id ?? poiId,
            resource_type: fixedPoiType,
            attrs: undefined,
        })
    }, [poiId, fixedPoiType, fixedPoi, createModalVisible, form])


    // 创建资源并可绑定供应商
    const handleCreateResource = async (values: any) => {
        try {
            const resolvedPoiId = poiId ?? values.poi_id
            if (!resolvedPoiId) {
                message.warning('请选择POI')
                return
            }
            const resolvedResourceType = resourceType ?? values.resource_type
            // 1. 先创建资源
            const resourcePayload: any = {
                poi_id: resolvedPoiId,
                resource_name: values.resource_name,
                resource_code: values.resource_code,
                resource_type: resolvedResourceType,
                status: 'active',
            }

            // 2. 添加特定类型的attrs字段（景区/酒店的详细信息）
            if (values.attrs) {
                resourcePayload.attrs = values.attrs
            }

            const newResource = await apiRequest<{ id: string }>('/api/resources', {
                method: 'POST',
                body: JSON.stringify(resourcePayload),
            })

            // 3. 再创建供应商-资源绑定关系（可选）
            const agreementErrors: string[] = []
            const bindings = values.supplier_bindings || []
            for (let i = 0; i < bindings.length; i += 1) {
                const binding = bindings[i]
                const bindingPayload = {
                    supplier_id: binding.supplier_id,
                    resource_id: newResource.id,
                    settlement_price: binding.settlement_price,
                    supply_status: 'active',
                }
                const createdBinding = await apiRequest<{ id: number }>('/api/supplier-resources', {
                    method: 'POST',
                    body: JSON.stringify(bindingPayload),
                })

                const presetList = pendingAgreements[i] || []
                for (const preset of presetList) {
                    try {
                        await apiRequest('/api/supplier-resource-agreements', {
                            method: 'POST',
                            body: JSON.stringify({
                                supplier_resource_id: createdBinding.id,
                                ...preset,
                            }),
                        })
                    } catch (err: any) {
                        agreementErrors.push(err?.message || '协议创建失败')
                    }
                }
            }

            message.success('资源创建成功')
            if (agreementErrors.length > 0) {
                message.warning(`资源已创建，但有 ${agreementErrors.length} 份协议创建失败`)
            }
            setCreateModalVisible(false)
            form.resetFields()
            setResourceType(null) // 重置资源类型
            setIsTypeLocked(false)
            setPendingAgreements({})
            setPresetAgreementModal({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })
            await refresh()
        } catch (err: any) {
            if (err.message?.includes('duplicate')) {
                message.warning('该POI下已存在同名同类型的资源')
            } else {
                message.error(err.message || '创建失败')
            }
        }
    }

    const handleUpdateResource = async (values: any) => {
        if (!selectedResource) return
        try {
            // 1. 更新资源基本信息
            const resourcePayload: any = {
                poi_id: poiId ?? values.poi_id,
                resource_name: values.resource_name,
                resource_code: values.resource_code,
                status: values.status,
            }

            // 添加attrs字段（景区/酒店特定信息）
            if (values.attrs) {
                resourcePayload.attrs = values.attrs
            }

            // 检查资源基本信息或attrs是否有变化
            const hasBasicChange =
                selectedResource.poi_id !== resourcePayload.poi_id ||
                selectedResource.resource_name !== resourcePayload.resource_name ||
                selectedResource.resource_code !== resourcePayload.resource_code ||
                selectedResource.status !== resourcePayload.status ||
                JSON.stringify(selectedResource.attrs) !== JSON.stringify(resourcePayload.attrs)

            if (hasBasicChange) {
                await apiRequest(`/api/resources/${selectedResource.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(resourcePayload)
                })
            }

            // 2. 处理供应商绑定
            // 获取现有绑定
            const existingBindings = getResourceSuppliers(selectedResource.id)
            const newBindings = values.supplier_bindings || []

            // 找出需要删除的绑定（在现有列表中但不在新列表中）
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

            // 处理新增或更新的绑定
            for (const binding of newBindings) {
                const existingBinding = existingBindings.find((eb: any) =>
                    Number(eb.supplier_id) === Number(binding.supplier_id)
                )

                if (existingBinding) {
                    // 更新结算价
                    if (existingBinding.settlement_price !== binding.settlement_price) {
                        await apiRequest(`/api/supplier-resources/${existingBinding.id}/adjust-price`, {
                            method: 'POST',
                            body: JSON.stringify({
                                settlement_price: binding.settlement_price,
                                reason: '资源编辑时修改结算价'
                            })
                        })
                    }
                } else {
                    // 创建新绑定
                    await apiRequest('/api/supplier-resources', {
                        method: 'POST',
                        body: JSON.stringify({
                            supplier_id: binding.supplier_id,
                            resource_id: selectedResource.id,
                            settlement_price: binding.settlement_price,
                            supply_status: 'active',
                        })
                    })
                }
            }

            message.success('资源已更新')
            setEditModalVisible(false)
            setSelectedResource(null)
            setResourceType(null) // 重置资源类型
            await refresh()
        } catch (err: any) {
            message.error(err.message || '更新失败')
        }
    }

    const deleteResource = async (id: string) => {
        try {
            await apiRequest(`/api/resources/${id}`, { method: 'DELETE' })
            message.success('资源已删除')
            await refresh()
        } catch (err: any) {
            message.error(err.message || '删除失败')
        }
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) return
        try {
            await apiRequest('/api/resources/batch-delete', {
                method: 'POST',
                body: JSON.stringify(selectedRowKeys)
            })
            message.success(`已删除 ${selectedRowKeys.length} 个资源`)
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
            if (values.status) fields.status = values.status

            if (Object.keys(fields).length === 0) {
                message.warning('请至少输入一个要修改的字段')
                return
            }

            await apiRequest('/api/resources/batch-update', {
                method: 'POST',
                body: JSON.stringify({
                    ids: selectedRowKeys,
                    fields
                })
            })
            message.success(`已更新 ${selectedRowKeys.length} 个资源`)
            setBatchUpdateVisible(false)
            batchUpdateForm.resetFields()
            setSelectedRowKeys([])
            await refresh()
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
    }

    const handleSaveInventory = async () => {
        if (!selectedResource || !selectedSupplierId) {
            message.warning("请选择供应商")
            return
        }
        // Find supplier resource id
        const sr = supplierResources.find(
            s => (s.resource_id as unknown as number) === Number(selectedResource.id) && (s.supplier_id as unknown as number) === selectedSupplierId
        )
        if (!sr) {
            message.error("未找到供应商绑定信息")
            return
        }

        if (calendarRef.current) {
            await calendarRef.current.saveToBackend(Number(sr.id))
            setInventoryModalVisible(false)
            message.success('库存保存成功')
        }
    }

    // 获取资源关联的供应商列表
    const getResourceSuppliers = (resourceId: string | number) => {
        return supplierResources
            .filter((sr) => (sr.resource_id as unknown as number) === Number(resourceId))
            .map((sr) => ({
                ...sr,
                supplier: suppliers.find((s) => (s.id as unknown as number) === Number(sr.supplier_id)),
            }))
    }

    const baseColumns: any = [
        {
            title: '资源名称',
            dataIndex: 'resource_name',
            sorter: (a: Resource, b: Resource) => a.resource_name.localeCompare(b.resource_name),
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
            onFilter: (value: string, record: Resource) =>
                record.resource_name.toLowerCase().includes(value.toLowerCase()),
        },
        {
            title: '资源类型',
            dataIndex: 'resource_type',
            render: (v: string) => <Tag color="blue">{v}</Tag>,
            filters: RESOURCE_TYPES.map(t => ({ text: t, value: t })),
            onFilter: (value: string, record: Resource) => record.resource_type === value,
        },
        {
            title: '关联POI',
            dataIndex: 'poi_id',
            render: (v: string) => poiList.find((p) => p.id === v)?.poi_name || '-',
            sorter: (a: Resource, b: Resource) => {
                const poiA = poiList.find(p => p.id === a.poi_id)?.poi_name || ''
                const poiB = poiList.find(p => p.id === b.poi_id)?.poi_name || ''
                return poiA.localeCompare(poiB)
            },
        },
        {
            title: '供应商数',
            render: (_: any, record: Resource) => {
                const count = getResourceSuppliers(record.id).length
                return count
            },
            sorter: (a: Resource, b: Resource) => getResourceSuppliers(a.id).length - getResourceSuppliers(b.id).length,
        },
        {
            title: '供应商详情',
            render: (_: any, record: Resource) => {
                const bindings = getResourceSuppliers(record.id)
                if (bindings.length === 0) return <Tag color="red">未绑定</Tag>
                return (
                    <Space size={4} wrap>
                        {bindings.slice(0, 2).map((b) => (
                            <Tag key={b.id}>{b.supplier?.supplier_name}</Tag>
                        ))}
                        {bindings.length > 2 && <Tag>+{bindings.length - 2}</Tag>}
                    </Space>
                )
            },
            width: 200,
        },
        {
            title: '结算价',
            render: (_: any, record: Resource) => {
                const bindings = getResourceSuppliers(record.id)
                if (bindings.length === 0) return '-'
                return (
                    <Space direction="vertical" size={0}>
                        {bindings.map((b) => (
                            <div key={b.id} style={{ fontSize: 12 }}>
                                <span style={{ color: '#999', marginRight: 4 }}>{b.supplier?.supplier_name}:</span>
                                <span>{b.settlement_price ? `¥${b.settlement_price}` : '-'}</span>
                            </div>
                        ))}
                    </Space>
                )
            },
            width: 150,
        },
        {
            title: '状态',
            dataIndex: 'status',
            render: (v: string) => {
                const map: any = { active: '启用', inactive: '停用' }
                return <Tag color={v === 'active' ? 'green' : 'gray'}>{map[v] || v}</Tag>
            },
            filters: [
                { text: '启用', value: 'active' },
                { text: '停用', value: 'inactive' },
            ],
            onFilter: (value: string, record: Resource) => (record.status || 'active') === value,
        },
        {
            title: '最后更新时间',
            dataIndex: 'updated_at',
            render: (v: string) => v ? new Date(v).toLocaleString() : '-',
            sorter: (a: Resource, b: Resource) => new Date(a.updated_at || '').getTime() - new Date(b.updated_at || '').getTime(),
        },
        {
            title: '操作',
            width: 200,
            render: (_: any, record: Resource) => {
                const isLocked = productResources.some(pr => String(pr.resource_id) === String(record.id))

                return (
                    <Space>
                        <Button type="link" size="small" onClick={() => {
                            setSelectedResource(record)
                            setViewDrawerVisible(true)
                        }}>
                            查看
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<CalendarOutlined />}
                            onClick={() => {
                                setSelectedResource(record)
                                // Note: We don't set selectedResource for Drawer here, distinct flow
                                const srs = getResourceSuppliers(record.id)
                                if (srs.length > 0) {
                                    setSelectedSupplierId(Number(srs[0].supplier_id))
                                } else {
                                    setSelectedSupplierId(undefined)
                                }
                                setInventoryModalVisible(true)
                            }}
                        >
                            库存/价格
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                                setSelectedResource(record)
                                // 设置资源类型以显示对应字段
                                setResourceType(record.resource_type)
                                // 获取现有供应商绑定信息
                                const existingBindings = getResourceSuppliers(record.id).map(sr => ({
                                    supplier_id: sr.supplier_id,
                                    settlement_price: sr.settlement_price,
                                    binding_id: sr.id
                                }))
                                editForm.setFieldsValue({
                                    ...record,
                                    supplier_bindings: existingBindings.length > 0 ? existingBindings : []
                                })
                                setEditModalVisible(true)
                            }}
                        >
                            编辑
                        </Button>
                        {isLocked ? (
                            <Tooltip title="该资源已被产品使用(属于已创建产品)，不可删除">
                                <Button type="link" danger disabled size="small" icon={<DeleteOutlined />}>
                                    删除
                                </Button>
                            </Tooltip>
                        ) : (
                            <Popconfirm
                                title="确定删除该资源吗？"
                                description="删除资源会同时删除所有关联的供应商绑定信息"
                                onConfirm={() => deleteResource(record.id)}
                                okText="删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                            >
                                <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                                    删除
                                </Button>
                            </Popconfirm>
                        )}
                    </Space>
                )
            },
        },
    ]

    const columns = poiId ? baseColumns.filter((col: any) => col.dataIndex !== 'poi_id') : baseColumns

    return (
        <div className={isEmbedded ? undefined : 'page-container'}>
            {!isEmbedded && (
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="page-title">资源管理</h1>
                        <p className="page-subtitle">管理所有资源，可按需绑定供应商与结算价</p>
                    </div>
                    <Space>

                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                            新建资源
                        </Button>
                    </Space>
                </div>
            )}
            {isEmbedded && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>资源列表</h3>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                        新建资源
                    </Button>
                </div>
            )}

            {/* 高级筛选器 */}
            {!isEmbedded && (
                <Card size="small" style={{ marginBottom: 16 }} bodyStyle={{ padding: '16px' }}>
                    <Form layout="inline" style={{ width: '100%' }}>
                        <Row gutter={[16, 16]} style={{ width: '100%' }}>
                            <Col span={6}>
                                <Form.Item label="关键词" style={{ marginBottom: 0, width: '100%' }}>
                                    <Input
                                        placeholder="搜索资源名称"
                                        prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                        value={filters.keyword}
                                        onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                                        allowClear
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label="关联POI" style={{ marginBottom: 0, width: '100%' }}>
                                    <Select
                                        placeholder="全部POI"
                                        showSearch
                                        allowClear
                                        optionFilterProp="label"
                                        options={poiList.map(p => ({ value: p.id, label: p.poi_name }))}
                                        value={filters.poi_id}
                                        onChange={v => setFilters({ ...filters, poi_id: v })}
                                        style={{ width: '100%' }}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label="状态" style={{ marginBottom: 0, width: '100%' }}>
                                    <Select
                                        placeholder="全部状态"
                                        allowClear
                                        options={[
                                            { value: 'active', label: '启用' },
                                            { value: 'inactive', label: '停用' },
                                        ]}
                                        value={filters.status}
                                        onChange={v => setFilters({ ...filters, status: v })}
                                        style={{ width: '100%' }}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={6} style={{ textAlign: 'right' }}>
                                {selectedRowKeys.length > 0 && (
                                    <Space>
                                        <Button onClick={() => setBatchUpdateVisible(true)} icon={<SettingOutlined />}>
                                            批量修改
                                        </Button>
                                        <Popconfirm
                                            title={`确定删除选中的 ${selectedRowKeys.length} 个资源吗？`}
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
                            <Col span={24}>
                                <Form.Item label="资源类型" style={{ marginBottom: 0 }}>
                                    <Checkbox.Group
                                        options={RESOURCE_TYPES}
                                        value={filters.types}
                                        onChange={v => setFilters({ ...filters, types: v as string[] })}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Form>
                </Card>
            )}

            <div className="glass-card" style={{ padding: '24px' }}>
                <Table<Resource>
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredResources}
                    rowSelection={isEmbedded ? undefined : {
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                    }}
                    pagination={{
                        current: pagination.current,
                        pageSize: pagination.pageSize,
                        total: filteredResources.length,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
                        onShowSizeChange: (current, size) => setPagination({ current, pageSize: size })
                    }}
                    onChange={(p) => setPagination({ current: p.current || 1, pageSize: p.pageSize || 20 })}
                />
            </div>

            {/* 创建资源Modal */}
            <Modal
                title="创建资源"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false)
                    form.resetFields()
                    setResourceType(null) // 重置资源类型
                    setIsTypeLocked(false)
                    setPendingAgreements({})
                    setPresetAgreementModal({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })
                }}
                footer={null}
                width={720}
            >
                {/* ... existing form content ... */}
                <Form form={form} layout="vertical" onFinish={handleCreateResource}>
                    <Form.Item name="poi_id" label="所属POI" rules={[{ required: true, message: '请选择POI' }]}>
                        <Select
                            placeholder="选择POI"
                            showSearch
                            allowClear={!poiId}
                            optionFilterProp="label"
                            disabled={Boolean(poiId)}
                            options={poiList.map((p) => ({ value: p.id, label: `${p.poi_name} (${p.city})` }))}
                            onChange={(value) => {
                                if (!value) {
                                    setIsTypeLocked(false)
                                    setResourceType(null)
                                    form.setFieldsValue({ resource_type: undefined, attrs: undefined })
                                    return
                                }
                                const selectedPoi = poiList.find(p => p.id === value)
                                if (selectedPoi && selectedPoi.poi_type && RESOURCE_TYPES.includes(selectedPoi.poi_type)) {
                                    const shouldLock = selectedPoi.poi_type !== '其他'
                                    setIsTypeLocked(shouldLock)
                                    setResourceType(selectedPoi.poi_type)
                                    form.setFieldsValue({
                                        resource_type: selectedPoi.poi_type,
                                        attrs: undefined
                                    })
                                } else {
                                    setIsTypeLocked(false)
                                }
                            }}
                        />
                    </Form.Item>
                    <Form.Item name="resource_name" label="资源名称" rules={[{ required: true, message: '请输入资源名称' }]}>
                        <Input placeholder="例如：标准双床房" />
                    </Form.Item>
                    <Form.Item name="resource_code" label="资源编码">
                        <Input placeholder="例如：RES-001" />
                    </Form.Item>
                    <Form.Item name="resource_type" label="资源类型" rules={[{ required: true, message: '请选择资源类型' }]}>
                        <Select
                            placeholder="选择类型"
                            disabled={isTypeLocked || Boolean(poiId)}
                            options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))}
                            onChange={(value) => {
                                setResourceType(value)
                                // 清除之前的attrs字段
                                form.setFieldValue('attrs', undefined)
                            }}
                        />
                    </Form.Item>

                    {resourceType === '景区' && (
                        <TicketResourceFields
                            typeOptions={getFormOptions(createFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(createFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(createFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(createFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(createFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {resourceType === '酒店' && (
                        <HotelResourceFields
                            typeOptions={getFormOptions(createFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(createFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(createFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(createFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(createFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {resourceType === '餐饮' && (
                        <DiningResourceFields
                            typeOptions={getFormOptions(createFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(createFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(createFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(createFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(createFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {resourceType === '交通' && (
                        <TransportResourceFields
                            typeOptions={getFormOptions(createFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(createFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(createFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(createFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(createFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}

                    <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                        <h4 style={{ marginBottom: 12 }}>供应商绑定（可选）</h4>
                        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                            可先创建资源，再视需要绑定供应商。同一资源可以绑定多个供应商，每个供应商有独立的结算价。
                        </p>
                        <Form.List name="supplier_bindings">
                            {(fields, { add, remove }, { errors }) => (
                                <>
                                    {fields.map(({ key, name, ...restField }) => (
                                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'supplier_id']}
                                                rules={[{ required: true, message: '请选择供应商' }]}
                                                style={{ marginBottom: 0, width: 200 }}
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

                                            <Form.Item
                                                shouldUpdate={() => true}
                                                noStyle
                                            >
                                                {({ getFieldValue }) => {
                                                    const supplierId = getFieldValue(['supplier_bindings', name, 'supplier_id'])
                                                    const supplier = suppliers.find(s => String(s.id) === String(supplierId))
                                                    const agreementCount = pendingAgreements[name]?.length || 0
                                                    const disabled = !supplierId
                                                    return (
                                                        <Tooltip title={disabled ? '请先选择供应商' : '预设协议'}>
                                                            <Button
                                                                type="link"
                                                                size="small"
                                                                disabled={disabled}
                                                                onClick={() => {
                                                                    if (disabled) return
                                                                    setPresetAgreementModal({
                                                                        visible: true,
                                                                        fieldIndex: name,
                                                                        supplierId: supplierId,
                                                                        supplierName: supplier?.supplier_name || '未知供应商',
                                                                        supplierFolderId: supplier?.folder_id || null
                                                                    })
                                                                }}
                                                            >
                                                                预设协议{agreementCount > 0 ? ` (${agreementCount})` : ''}
                                                            </Button>
                                                        </Tooltip>
                                                    )
                                                }}
                                            </Form.Item>

                                            <Button
                                                type="link"
                                                danger
                                                onClick={() => {
                                                    remove(name)
                                                    setPendingAgreements(prev => {
                                                        const next: Record<number, any[]> = {}
                                                        Object.entries(prev).forEach(([k, v]) => {
                                                            const idx = Number(k)
                                                            if (idx < name) next[idx] = v
                                                            if (idx > name) next[idx - 1] = v
                                                        })
                                                        return next
                                                    })
                                                }}
                                            >
                                                删除
                                            </Button>
                                        </Space>
                                    ))}
                                    <Form.Item style={{ marginBottom: 0 }}>
                                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                            添加供应商
                                        </Button>
                                        <Form.ErrorList errors={errors} />
                                    </Form.Item>
                                </>
                            )}
                        </Form.List>
                    </div>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setCreateModalVisible(false)
                                form.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                创建资源
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>



            {/* 编辑资源Modal */}
            <Modal
                title={`编辑资源: ${selectedResource?.resource_name}`}
                open={editModalVisible}
                onCancel={() => {
                    setEditModalVisible(false)
                    setSelectedResource(null)
                    editForm.resetFields()
                    setResourceType(null) // 重置资源类型
                }}
                footer={null}
                width={720}
            >
                <Form form={editForm} layout="vertical" onFinish={handleUpdateResource}>
                    <Form.Item name="poi_id" label="所属POI" rules={[{ required: true, message: '请选择POI' }]}>
                        <Select
                            placeholder="选择POI"
                            showSearch
                            optionFilterProp="label"
                            disabled={Boolean(poiId)}
                            options={poiList.map((p) => ({ value: p.id, label: `${p.poi_name} (${p.city})` }))}
                        />
                    </Form.Item>
                    <Form.Item name="resource_name" label="资源名称" rules={[{ required: true, message: '请输入资源名称' }]}>
                        <Input placeholder="例如：标准双床房" />
                    </Form.Item>
                    <Form.Item name="resource_code" label="资源编码">
                        <Input placeholder="例如：RES-001" />
                    </Form.Item>
                    <Form.Item name="resource_type" label="资源类型" rules={[{ required: true, message: '请选择资源类型' }]}>
                        <Select
                            placeholder="选择类型"
                            disabled
                            options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))}
                        />
                    </Form.Item>
                    <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                        <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
                    </Form.Item>

                    {/* 根据资源类型动态显示特定字段 */}
                    {resourceType === '景区' && (
                        <TicketResourceFields
                            typeOptions={getFormOptions(editFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(editFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(editFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(editFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(editFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {resourceType === '酒店' && (
                        <HotelResourceFields
                            typeOptions={getFormOptions(editFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(editFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(editFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(editFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(editFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {resourceType === '餐饮' && (
                        <DiningResourceFields
                            typeOptions={getFormOptions(editFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(editFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(editFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(editFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(editFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {resourceType === '交通' && (
                        <TransportResourceFields
                            typeOptions={getFormOptions(editFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(editFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(editFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(editFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(editFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}

                    <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                        <h4 style={{ marginBottom: 12 }}>供应商绑定（可选）</h4>
                        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                            管理资源的供应商和结算价。修改结算价会自动创建价格调整记录。
                        </p>
                        <Form.List name="supplier_bindings">
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.map(({ key, name, ...restField }) => (
                                        <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                                            <Form.Item
                                                {...restField}
                                                name={[name, 'supplier_id']}
                                                rules={[{ required: true, message: '请选择供应商' }]}
                                                style={{ marginBottom: 0, width: 200 }}
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
                                            <Form.Item
                                                shouldUpdate={() => true}
                                                noStyle
                                            >
                                                {({ getFieldValue }) => {
                                                    const supplierId = getFieldValue(['supplier_bindings', name, 'supplier_id'])
                                                    const bindingIdFromForm = getFieldValue(['supplier_bindings', name, 'binding_id'])
                                                    const resolvedBindingId = bindingIdFromForm || supplierResources.find(
                                                        sr => Number(sr.resource_id) === Number(selectedResource?.id) && Number(sr.supplier_id) === Number(supplierId)
                                                    )?.id

                                                    if (resolvedBindingId && supplierId) {
                                                        return (
                                                            <Button
                                                                type="link"
                                                                size="small"
                                                                onClick={() => {
                                                                    const supplier = suppliers.find(s => s.id === supplierId)
                                                                    setAgreementModalState({
                                                                        visible: true,
                                                                        supplierResourceId: resolvedBindingId,
                                                                        supplierName: supplier?.supplier_name || '未知供应商',
                                                                        supplierFolderId: supplier?.folder_id || null
                                                                    })
                                                                }}
                                                            >
                                                                协议
                                                            </Button>
                                                        )
                                                    }
                                                    return null
                                                }}
                                            </Form.Item>

                                            <Form.Item name={[name, 'binding_id']} hidden>
                                                <Input />
                                            </Form.Item>

                                            <Button type="link" danger onClick={() => remove(name)}>
                                                删除
                                            </Button>
                                        </Space>
                                    ))}
                                    <Form.Item style={{ marginBottom: 0 }}>
                                        <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                                            添加供应商
                                        </Button>
                                    </Form.Item>
                                </>
                            )}
                        </Form.List>
                    </div>

                    <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setEditModalVisible(false)
                                setSelectedResource(null)
                                editForm.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                保存修改
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 批量更新 Modal */}
            <Modal
                title={`批量修改已选的 ${selectedRowKeys.length} 个资源`}
                open={batchUpdateVisible}
                onCancel={() => setBatchUpdateVisible(false)}
                footer={null}
            >
                <Form layout="vertical" form={batchUpdateForm} onFinish={handleBatchUpdate}>
                    <p style={{ color: '#999', marginBottom: 16 }}>
                        请填写需要修改的字段，留空则不修改
                    </p>
                    <Form.Item name="status" label="状态">
                        <Select options={[
                            { value: 'active', label: '启用' },
                            { value: 'inactive', label: '停用' },
                        ]} allowClear placeholder="批量修改状态" />
                    </Form.Item>
                    <Space style={{ float: 'right', marginTop: 16 }}>
                        <Button onClick={() => setBatchUpdateVisible(false)}>取消</Button>
                        <Button type="primary" htmlType="submit">
                            确认修改
                        </Button>
                    </Space>
                </Form>
            </Modal>

            {/* 库存日历 Modal */}
            <Modal
                title={`库存管理 - ${selectedResource?.resource_name}`}
                open={inventoryModalVisible}
                onCancel={() => setInventoryModalVisible(false)}
                width={1000}
                onOk={handleSaveInventory}
                okText="保存全部更改"
                cancelText="取消"
                destroyOnClose
            >
                {selectedResource && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
                            <span style={{ marginRight: 8, fontWeight: 'bold' }}>当前供应商:</span>
                            <Select
                                style={{ width: 300 }}
                                value={selectedSupplierId}
                                onChange={setSelectedSupplierId}
                                placeholder="请选择供应商"
                                options={getResourceSuppliers(selectedResource.id).map(sr => ({
                                    value: sr.supplier?.id,
                                    label: sr.supplier?.supplier_name
                                }))}
                            />
                            {!selectedSupplierId && <span style={{ color: 'red', marginLeft: 8 }}>请先选择一个供应商来管理库存</span>}
                        </div>
                        <p style={{ color: '#666', marginBottom: 8 }}>
                            请在日历上设置每天的库存数量。库存数据是基于“供应商+资源”的组合。
                        </p>

                        {(() => {
                            // Find current supplier resource ID
                            const currentSR = supplierResources.find(
                                s => (s.resource_id as unknown as number) === Number(selectedResource.id) && (s.supplier_id as unknown as number) === selectedSupplierId
                            );

                            // Only render calendar if we have a valid supplier resource ID
                            if (!currentSR) return null;

                            return (
                                <SKUCalendarEditor
                                    ref={calendarRef}
                                    supplierResourceId={Number(currentSR.id)}
                                    mode="resource"
                                    defaultPrice={currentSR.settlement_price}
                                />
                            );
                        })()}
                    </div>
                )}
            </Modal>


            {/* 资源详情Drawer */}
            <Drawer
                title={selectedResource?.resource_name}
                open={viewDrawerVisible}
                onClose={() => {
                    setViewDrawerVisible(false)
                    setSelectedResource(null)
                }}
                width={600}
            >
                {selectedResource && (
                    <>
                        <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="资源名称">{selectedResource.resource_name}</Descriptions.Item>
                            <Descriptions.Item label="资源编码">{selectedResource.resource_code || '-'}</Descriptions.Item>
                            <Descriptions.Item label="资源类型">
                                <Tag color="blue">{selectedResource.resource_type}</Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="所属POI">
                                {poiList.find((p) => p.id === selectedResource.poi_id)?.poi_name || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={selectedResource.status === 'active' ? 'green' : 'gray'}>
                                    {selectedResource.status === 'active' ? '启用' : selectedResource.status === 'inactive' ? '停用' : selectedResource.status || '启用'}
                                </Tag>
                            </Descriptions.Item>
                        </Descriptions>

                        <h4 style={{ marginBottom: 12 }}>供应商绑定信息</h4>
                        <Table
                            size="small"
                            pagination={false}
                            rowKey="id"
                            dataSource={getResourceSuppliers(selectedResource.id)}
                            columns={[
                                {
                                    title: '供应商',
                                    dataIndex: ['supplier', 'supplier_name'],
                                    render: (v: string) => v || '-',
                                },
                                {
                                    title: '结算价',
                                    dataIndex: 'settlement_price',
                                    render: (v: number) => v ? `¥${v}` : '-'
                                },
                                {
                                    title: '供应状态',
                                    dataIndex: 'supply_status',
                                    render: (v: string) => {
                                        const map: any = { active: '启用', inactive: '停用' }
                                        return <Tag color={v === 'active' ? 'green' : 'gray'}>{map[v] || v}</Tag>
                                    }
                                },
                            ]}
                        />
                    </>
                )}
            </Drawer>

            <AgreementModal
                visible={agreementModalState.visible}
                onCancel={() => setAgreementModalState(prev => ({ ...prev, visible: false }))}
                supplierResourceId={agreementModalState.supplierResourceId}
                supplierName={agreementModalState.supplierName}
                supplierFolderId={agreementModalState.supplierFolderId}
            />

            <PresetAgreementEditor
                visible={presetAgreementModal.visible}
                onCancel={() => setPresetAgreementModal(prev => ({ ...prev, visible: false }))}
                onSave={(agreements) => {
                    setPendingAgreements(prev => ({
                        ...prev,
                        [presetAgreementModal.fieldIndex]: agreements
                    }))
                }}
                supplierName={presetAgreementModal.supplierName}
                supplierFolderId={presetAgreementModal.supplierFolderId}
                initialAgreements={pendingAgreements[presetAgreementModal.fieldIndex] || []}
            />
        </div >
    )
}
