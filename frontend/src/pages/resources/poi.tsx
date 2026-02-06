import { useState, useMemo, useEffect } from 'react'
import { Button, Form, Input, Select, Table, Modal, Space, Statistic, message, Card, Row, Col, Popconfirm, Tooltip, Divider, Switch, InputNumber, Tag } from 'antd'
import { EditOutlined, SearchOutlined, DeleteOutlined, SettingOutlined, PlusOutlined, EyeOutlined } from '@ant-design/icons'
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
import ContactTableEditor from '@/components/ContactTableEditor'
import POIFileModal from '@/components/POIFileModal'
import POIDetailDrawer from '@/components/POIDetailDrawer'
import PresetAgreementEditor from '@/components/PresetAgreementEditor'

const POI_TYPES = ['景区', '酒店', '餐饮', '交通'] // POI类型（不含组合）
const COMBINATION_RESOURCE_TYPE = '组合'

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
    const { data, loadData } = useData()
    useEffect(() => {
        loadData(['poi', 'resources', 'suppliers', 'supplier_resources'])
    }, [loadData])
    const [currentTypeOptions, setCurrentTypeOptions] = useState<Record<string, string[]>>({})

    const handleTypeOptionsChange = (fieldKey: string, newOptions: string[]) => {
        setCurrentTypeOptions(prev => ({
            ...prev,
            [fieldKey]: newOptions
        }))
    }
    const handleTypeOptionAdd = (fieldKey: string, option: string) => {
        setCurrentTypeOptions(prev => ({
            ...prev,
            [fieldKey]: [...(prev[fieldKey] || []), option]
        }))
    }
    const handleTypeOptionDelete = (fieldKey: string, option: string) => {
        setCurrentTypeOptions(prev => ({
            ...prev,
            [fieldKey]: (prev[fieldKey] || []).filter(o => o !== option)
        }))
    }
    const handleTypeOptionRename = (fieldKey: string, oldVal: string, newVal: string) => {
        setCurrentTypeOptions(prev => ({
            ...prev,
            [fieldKey]: (prev[fieldKey] || []).map(o => o === oldVal ? newVal : o)
        }))
    }
    const [poiForm] = Form.useForm()
    const [poiEditForm] = Form.useForm()
    const [batchUpdateForm] = Form.useForm()
    const [memberCreateForm] = Form.useForm()
    const [selectedPoi, setSelectedPoi] = useState<POI | null>(null)
    const [searchParams] = useSearchParams()
    const [detailAutoOpened, setDetailAutoOpened] = useState(false)
    const [drawerReadOnly, setDrawerReadOnly] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
    const [batchUpdateVisible, setBatchUpdateVisible] = useState(false)
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })
    const [createModalVisible, setCreateModalVisible] = useState(false) // 新建POI Modal
    const [poiType, setPoiType] = useState<string | null>(null) // 新建POI时选择的类型
    const [createResourceEnabled, setCreateResourceEnabled] = useState(false)
    const [pendingAgreements, setPendingAgreements] = useState<Record<string, any[]>>({})
    const [presetAgreementModal, setPresetAgreementModal] = useState<{
        visible: boolean
        resourceIndex: number
        supplierIndex: number
        supplierName: string
        supplierFolderId: number | null
    }>({ visible: false, resourceIndex: -1, supplierIndex: -1, supplierName: '', supplierFolderId: null })
    const [createdPoi, setCreatedPoi] = useState<POI | null>(null)
    const [creatingPoi, setCreatingPoi] = useState(false)
    const [fileManagerPoi, setFileManagerPoi] = useState<POI | null>(null)  // 文件管理Modal的目标POI
    const [resourceStatuses, setResourceStatuses] = useState<Record<number, { saving?: boolean; saved?: boolean }>>({})
    const [memberCreateModalVisible, setMemberCreateModalVisible] = useState(false)
    const [memberCreateTarget, setMemberCreateTarget] = useState<{ resourceIndex: number; fieldKey: number } | null>(null)
    const [memberCreateType, setMemberCreateType] = useState<string | null>(null)
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
                    is_combination: false,
                    combination_members: [],
                    supplier_bindings: [],
                },
            ])
            return
        }
        const nextResources = currentResources.map((resource: any) => ({
            ...resource,
            resource_type: resource.is_combination ? COMBINATION_RESOURCE_TYPE : poiType,
            attrs: resource.is_combination ? undefined : (resource.resource_type === poiType ? resource.attrs : undefined),
            combination_members: resource.is_combination ? (resource.combination_members || []) : [],
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

    const normalizeMemberIds = (values: any): number[] => {
        if (!Array.isArray(values)) return []
        return Array.from(new Set(values.map((id) => Number(id)).filter((id) => Number.isFinite(id))))
    }

    const combinationMemberOptions = useMemo(() => {
        return resources.map((resource: any) => {
            const poiName = poiList.find((poi) => String(poi.id) === String(resource.poi_id))?.poi_name || '-'
            return {
                value: Number(resource.id),
                label: `${resource.resource_name} (${poiName} / ${resource.is_combination ? COMBINATION_RESOURCE_TYPE : resource.resource_type})`,
            }
        })
    }, [resources, poiList])

    const memberCreatePoiOptions = useMemo(() => {
        const merged = [...poiList]
        if (createdPoi && !merged.some((poi) => String(poi.id) === String(createdPoi.id))) {
            merged.push(createdPoi)
        }
        return merged.map((poi) => ({
            value: Number(poi.id),
            label: `${poi.poi_name} (${poi.city})`,
        }))
    }, [poiList, createdPoi])

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
            title: '资源名称',
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
            title: '子资源数',
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
            width: 220,
            render: (_: any, record: POI) => {
                const resourceCount = resources.filter(r => r.poi_id === record.id).length
                const isLocked = resourceCount > 0

                return (
                    <Space>
                        <Button
                            type="link"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => {
                                setDrawerReadOnly(false)
                                setSelectedPoi(record)
                            }}
                        >
                            编辑
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => {
                                setDrawerReadOnly(true)
                                setSelectedPoi(record)
                            }}
                        >
                            查看
                        </Button>
                        {isLocked ? (
                            <Tooltip title="该资源下已有子资源(数量不为0)，不可删除">
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
                                title="确定删除该资源吗？"
                                description="删除资源可能影响关联的子资源，请谨慎操作"
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
        memberCreateForm.resetFields()
        setPoiType(null)
        setCreateResourceEnabled(false)
        setCreatedPoi(null)
        setResourceStatuses({})
        setMemberCreateModalVisible(false)
        setMemberCreateTarget(null)
        setMemberCreateType(null)
        setCreatingPoi(false)
        setCreateCityOptions([])
        setCreateDistrictOptions([])
        setCurrentTypeOptions({})
        setPendingAgreements({})
        setPresetAgreementModal({ visible: false, resourceIndex: -1, supplierIndex: -1, supplierName: '', supplierFolderId: null })
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
    const getPresetKey = (resourceIndex: number, supplierIndex: number) => `${resourceIndex}:${supplierIndex}`

    const openMemberCreateModal = (resourceIndex: number, fieldKey: number) => {
        if (memberCreatePoiOptions.length === 0) {
            message.warning('暂无可用资源，请先创建资源')
            return
        }
        setMemberCreateTarget({ resourceIndex, fieldKey })
        setMemberCreateType(null)
        memberCreateForm.resetFields()
        memberCreateForm.setFieldsValue({
            poi_id: createdPoi ? Number(createdPoi.id) : undefined,
            is_combination: false,
        })
        setMemberCreateModalVisible(true)
    }

    const handleCreateCombinationMember = async (values: any) => {
        if (!memberCreateTarget) {
            message.warning('未找到目标组合子资源，请重试')
            return
        }
        try {
            const payload: any = {
                poi_id: values.poi_id,
                resource_name: values.resource_name,
                resource_code: values.resource_code,
                resource_type: values.resource_type,
                attrs: values.attrs,
                is_combination: false,
                create_mode: 'combination_member',
                status: 'active',
            }
            const created = await apiRequest<{ id: number }>('/api/resources', {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            await loadData(['poi', 'resources', 'suppliers', 'supplier_resources'], { force: true })

            const targetResource = poiForm.getFieldValue(['resources', memberCreateTarget.resourceIndex])
            if (!targetResource) {
                message.warning('目标组合子资源已不存在，请重新选择')
            } else {
                const current = normalizeMemberIds(targetResource.combination_members)
                poiForm.setFieldValue(
                    ['resources', memberCreateTarget.resourceIndex, 'combination_members'],
                    Array.from(new Set([...current, Number(created.id)]))
                )
                updateResourceStatus(memberCreateTarget.fieldKey, { saved: false })
                message.success('成员资源已创建并加入组合')
            }

            setMemberCreateModalVisible(false)
            setMemberCreateTarget(null)
            setMemberCreateType(null)
            memberCreateForm.resetFields()
        } catch (err: any) {
            message.error(err?.message || '成员资源创建失败')
        }
    }

    const createPoi = async () => {
        setCreatingPoi(true)
        try {
            await poiForm.validateFields(['poi_name', 'poi_type', 'province', 'city', 'district', 'address', 'attrs'])
            const rawPayload = poiForm.getFieldsValue(true)
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
                type_options: currentTypeOptions,
            }
            delete (poiPayload as { resources?: unknown }).resources
            const newPoi = await apiRequest<POI>('/api/poi', { method: 'POST', body: JSON.stringify(poiPayload) })
            setCreatedPoi(newPoi)
            await loadData(['poi', 'resources', 'suppliers', 'supplier_resources'], { force: true })
            return newPoi
        } catch (err: any) {
            if (err?.errorFields) {
                // 字段标签映射（包含通用字段和 attrs 嵌套字段）
                const fieldLabels: Record<string, string> = {
                    // 通用字段
                    'poi_name': '资源名称',
                    'poi_type': '资源类型',
                    'province': '省份',
                    'city': '城市',
                    'district': '区县',
                    'address': '详细地址',
                    // 景区 POI attrs 字段
                    'entrance_times': '入园次数',
                    'earliest_entry_time': '最早入园时间',
                    'latest_entry_time': '最晚入园时间',
                    'pickup_location': '取票地址',
                    'required_traveler_info': '所需出行人信息',
                    'voucher_type': '凭证类型',
                    // 酒店 POI attrs 字段
                    'hotel_type': '酒店类型',
                    'phone': '联系电话',
                    // 其他类型可以继续添加...
                }

                const missingFields: string[] = []
                err.errorFields.forEach((f: any) => {
                    const fieldPath = Array.isArray(f.name) ? f.name : [f.name]
                    // 处理顶层字段
                    if (fieldPath.length === 1) {
                        const label = fieldLabels[fieldPath[0]] || fieldPath[0]
                        if (!missingFields.includes(label)) missingFields.push(label)
                    }
                    // 处理 attrs 嵌套字段
                    else if (fieldPath[0] === 'attrs' && fieldPath.length >= 2) {
                        const attrKey = fieldPath[1]
                        const label = fieldLabels[attrKey] || attrKey
                        if (!missingFields.includes(label)) missingFields.push(label)
                    }
                })

                if (missingFields.length > 0) {
                    message.error(`请填写以下必填字段：${missingFields.join('、')}`)
                } else {
                    message.error('请检查表单填写是否正确')
                }
            } else {
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
            message.success('资源已创建，请逐条保存子资源')
        } else {
            message.success('资源已创建，可以上传详情图片')
            resetCreateModal()
            // 打开文件管理Modal
            setFileManagerPoi(newPoi)
        }
    }

    const handleSaveResource = async (resourceIndex: number, fieldKey: number) => {
        if (resourceStatuses[fieldKey]?.saving) return
        updateResourceStatus(fieldKey, { saving: true })
        try {
            const draftResource = poiForm.getFieldValue(['resources', resourceIndex]) || {}
            const isCombinationDraft = !!draftResource.is_combination
            const fieldsToValidate: (string | number)[][] = [
                ['resources', resourceIndex, 'resource_name'],
                ['resources', resourceIndex, 'resource_type'],
                ['resources', resourceIndex, 'supplier_bindings'],
            ]
            if (isCombinationDraft) {
                fieldsToValidate.push(['resources', resourceIndex, 'combination_members'])
            } else {
                fieldsToValidate.push(['resources', resourceIndex, 'attrs'])
            }
            await poiForm.validateFields(fieldsToValidate)

            const hadPoi = !!createdPoi
            const targetPoi = await ensureCreatedPoi()
            if (!targetPoi) return

            const resource = poiForm.getFieldValue(['resources', resourceIndex]) || {}
            const resourceId = resource.id || resource.resource_id
            const agreementErrors: string[] = []
            const isCombination = !!resource.is_combination
            const memberIds = normalizeMemberIds(resource.combination_members)
            if (isCombination && memberIds.length < 2) {
                message.error('组合资源至少需要2个成员资源')
                return
            }
            const resourcePayload: any = {
                poi_id: targetPoi.id,
                resource_name: resource.resource_name,
                resource_code: resource.resource_code,
                resource_type: isCombination ? COMBINATION_RESOURCE_TYPE : (targetPoi.poi_type || poiType),
                is_combination: isCombination,
                combination_members: isCombination ? memberIds : [],
                status: 'active',
            }
            if (!isCombination && resource.attrs) {
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

                for (let bindingIndex = 0; bindingIndex < newBindings.length; bindingIndex += 1) {
                    const binding = newBindings[bindingIndex]
                    const existingBinding = existingBindings.find(
                        (eb) => Number(eb.supplier_id) === Number(binding.supplier_id)
                    )
                    if (existingBinding) {
                        if (Number(existingBinding.settlement_price) !== Number(binding.settlement_price)) {
                            await apiRequest(`/api/supplier-resources/${existingBinding.id}/adjust-price`, {
                                method: 'POST',
                                body: JSON.stringify({
                                    settlement_price: binding.settlement_price,
                                    reason: '新建资源时子资源编辑修改结算价',
                                })
                            })
                        }
                    } else {
                        const createdBinding = await apiRequest<{ id: number }>('/api/supplier-resources', {
                            method: 'POST',
                            body: JSON.stringify({
                                supplier_id: binding.supplier_id,
                                resource_id: resourceId,
                                settlement_price: binding.settlement_price,
                                supply_status: 'active',
                            })
                        })
                        const presetKey = getPresetKey(resourceIndex, bindingIndex)
                        const presetList = pendingAgreements[presetKey] || []
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
                        if (presetList.length > 0) {
                            setPendingAgreements(prev => {
                                const next = { ...prev }
                                delete next[presetKey]
                                return next
                            })
                        }
                    }
                }

                message.success('子资源已更新')
                if (agreementErrors.length > 0) {
                    message.warning(`有 ${agreementErrors.length} 份协议创建失败`)
                }
            } else {
                const newResource = await apiRequest<{ id: string }>('/api/resources', {
                    method: 'POST',
                    body: JSON.stringify(resourcePayload),
                })

                const newBindings = resource.supplier_bindings || []
                for (let bindingIndex = 0; bindingIndex < newBindings.length; bindingIndex += 1) {
                    const binding = newBindings[bindingIndex]
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
                    const presetKey = getPresetKey(resourceIndex, bindingIndex)
                    const presetList = pendingAgreements[presetKey] || []
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
                    if (presetList.length > 0) {
                        setPendingAgreements(prev => {
                            const next = { ...prev }
                            delete next[presetKey]
                            return next
                        })
                    }
                }

                poiForm.setFieldValue(['resources', resourceIndex, 'id'], newResource.id)
                message.success(hadPoi ? '子资源已保存' : '资源已创建，子资源已保存')
                if (agreementErrors.length > 0) {
                    message.warning(`有 ${agreementErrors.length} 份协议创建失败`)
                }
            }

            updateResourceStatus(fieldKey, { saved: true })
            await loadData(['poi', 'resources', 'suppliers', 'supplier_resources'], { force: true })
        } catch (err: any) {
            if (err?.errorFields) {
                // 子资源字段标签映射
                const fieldLabels: Record<string, string> = {
                    // 通用子资源字段
                    'resource_name': '子资源名称',
                    'supplier_bindings': '供应商绑定',
                    // 景区子资源 attrs 字段
                    'ticket_type': '票种',
                    'min_age': '最小年龄',
                    'max_age': '最大年龄',
                    'booking_days_in_advance': '提前预订天数',
                    'hours': '小时',
                    'minutes': '分钟',
                    'validity_days': '可用时间',
                    // 酒店子资源 attrs 字段
                    'room_type': '房型',
                    'max_occupancy': '最大入住人数',
                    // 餐饮子资源 attrs 字段
                    'dining_type': '餐饮类型',
                    'meal_category': '餐饮分类',
                    'suitable_people': '适配人数',
                    // 交通子资源 attrs 字段
                    'transport_type': '交通类型',
                    'departure_point': '起点',
                    'arrival_point': '终点',
                    'max_seats': '最大座位数',
                    'duration': '行程时长',
                }

                const missingFields: string[] = []
                err.errorFields.forEach((f: any) => {
                    const fieldPath = Array.isArray(f.name) ? f.name : [f.name]

                    // 跳过 resources 前缀（第0个是 'resources'，第1个是索引）
                    let relevantPath = fieldPath
                    if (fieldPath[0] === 'resources' && typeof fieldPath[1] === 'number') {
                        relevantPath = fieldPath.slice(2) // 从索引2开始才是真正的字段路径
                    }

                    // 处理顶层字段（如 resource_name, supplier_bindings）
                    if (relevantPath.length === 1) {
                        const label = fieldLabels[relevantPath[0]] || relevantPath[0]
                        if (!missingFields.includes(label)) missingFields.push(label)
                    }
                    // 处理 attrs 嵌套字段
                    else if (relevantPath[0] === 'attrs' && relevantPath.length >= 2) {
                        const attrKey = relevantPath[1]
                        const label = fieldLabels[attrKey] || attrKey
                        if (!missingFields.includes(label)) missingFields.push(label)
                    }
                    // 处理 supplier_bindings 内部字段
                    else if (relevantPath[0] === 'supplier_bindings') {
                        if (!missingFields.includes('供应商绑定')) missingFields.push('供应商绑定')
                    }
                })

                if (missingFields.length > 0) {
                    message.error(`请填写以下必填字段：${missingFields.join('、')}`)
                } else {
                    message.error('请检查子资源表单填写是否正确')
                }
            } else {
                message.error(err.message || '子资源保存失败')
            }
        } finally {
            updateResourceStatus(fieldKey, { saving: false })
        }
    }

    const handleRemoveResource = (fieldKey: number, remove: (index: number) => void, index: number) => {
        if (memberCreateTarget?.resourceIndex === index) {
            setMemberCreateModalVisible(false)
            setMemberCreateTarget(null)
            setMemberCreateType(null)
            memberCreateForm.resetFields()
        } else if (memberCreateTarget && memberCreateTarget.resourceIndex > index) {
            setMemberCreateTarget({
                ...memberCreateTarget,
                resourceIndex: memberCreateTarget.resourceIndex - 1,
            })
        }
        setResourceStatuses((prev) => {
            const next = { ...prev }
            delete next[fieldKey]
            return next
        })
        setPendingAgreements((prev) => {
            const next: Record<string, any[]> = {}
            Object.entries(prev).forEach(([k, v]) => {
                const parts = k.split(':')
                const rIdx = Number(parts[0])
                const sIdx = Number(parts[1])
                if (rIdx < index) {
                    next[k] = v
                } else if (rIdx > index) {
                    next[`${rIdx - 1}:${sIdx}`] = v
                }
            })
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
                type_options: currentTypeOptions,
            }
            const attrsChanged = JSON.stringify(selectedPoi.attrs || {}) !== JSON.stringify(values.attrs || {})
            const typeOptionsChanged = JSON.stringify(selectedPoi.type_options || {}) !== JSON.stringify(currentTypeOptions || {})
            if (
                selectedPoi.poi_name === payload.poi_name &&
                (selectedPoi.poi_code || '') === (payload.poi_code || '') &&
                (selectedPoi.province || '') === (payload.province || '') &&
                selectedPoi.city === payload.city &&
                (selectedPoi.district || '') === (payload.district || '') &&
                selectedPoi.address === payload.address &&
                (selectedPoi.longitude ?? null) === (payload.longitude ?? null) &&
                (selectedPoi.latitude ?? null) === (payload.latitude ?? null) &&
                !attrsChanged &&
                !typeOptionsChanged
            ) {
                message.info('没有变更，无需保存')
                setSelectedPoi(null)
                return
            }
            await apiRequest(`/api/poi/${selectedPoi.id}`, { method: 'PUT', body: JSON.stringify(payload) })
            message.success('资源已保存')
            setSelectedPoi(null)
            await loadData(['poi', 'resources', 'suppliers', 'supplier_resources'], { force: true })
        } catch (err: any) {
            message.error(err.message || '保存失败')
        }
    }

    const deletePoi = async (id: string) => {
        try {
            await apiRequest(`/api/poi/${id}`, { method: 'DELETE' })
            message.success('资源已删除')
            await loadData(['poi', 'resources', 'suppliers', 'supplier_resources'], { force: true })
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
            message.success(`已删除 ${selectedRowKeys.length} 个资源`)
            setSelectedRowKeys([])
            await loadData(['poi', 'resources', 'suppliers', 'supplier_resources'], { force: true })
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
            message.success(`已更新 ${selectedRowKeys.length} 个资源`)
            setBatchUpdateVisible(false)
            batchUpdateForm.resetFields()
            setSelectedRowKeys([])
            await loadData(['poi', 'resources', 'suppliers', 'supplier_resources'], { force: true })
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
        // Initialize type options from selected POI
        setCurrentTypeOptions((selectedPoi.type_options as Record<string, string[]>) || {})

        poiEditForm.setFieldsValue({
            poi_name: selectedPoi.poi_name,
            poi_type: selectedPoi.poi_type,
            poi_code: selectedPoi.poi_code,
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
                <h1 className="page-title">资源管理</h1>
                <p className="page-subtitle">管理所有资源及其子资源，点击查看进入子资源列表与创建</p>
            </div>

            <Space size={12} style={{ width: '100%', marginBottom: 12, display: 'flex' }}>
                <div className="glass-card" style={{ flex: 1, padding: '16px' }}>
                    <Statistic title="资源总数" value={stats.poi} />
                </div>
                <div className="glass-card" style={{ flex: 1, padding: '16px' }}>
                    <Statistic title="子资源数" value={stats.resources} />
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
                                    placeholder="搜索资源名称或地址"
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
                                新建 资源
                            </Button>
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
                    </Row>
                </Form>
            </Card>


            {/* 资源列表 - 全宽显示 */}
            <div className="glass-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0 }}>资源列表</h3>
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

            {/* 新建资源 Modal */}
            <Modal
                title="新建 资源"
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
                        <Col span={10}>
                            <Form.Item name="poi_name" label="资源名称" rules={[{ required: true, message: '请输入资源名称' }]}>
                                <Input placeholder="如：丽江古城" />
                            </Form.Item>
                        </Col>
                        <Col span={7}>
                            <Form.Item name="poi_code" label="资源编码">
                                <Input placeholder="如：资源-001" />
                            </Form.Item>
                        </Col>
                        <Col span={7}>
                            <Form.Item name="poi_type" label="资源类型" rules={[{ required: true, message: '请选择资源类型' }]}>
                                <Select
                                    placeholder="选择资源类型（必选）"
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
                            ⚠️ 检测到同名同城的资源 ({suggestions.length}个)，请确认是否重复
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
                    {poiType === '景区' && <TicketPoiFields />}
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
                                            is_combination: false,
                                            combination_members: [],
                                            supplier_bindings: [],
                                        },
                                    ])
                                }
                            }}
                        />
                        <span style={{ fontWeight: 600 }}>同时创建子资源</span>
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
                                                            <span style={{ fontWeight: 600 }}>子资源 {index + 1}</span>
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
                                                                保存子资源
                                                            </Button>
                                                            {fields.length > 1 && (status?.saved ? (
                                                                <Tooltip title="已保存的子资源请在详情页删除">
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
                                                                    <Form.Item name={[field.name, 'resource_name']} label="子资源名称" rules={[{ required: true, message: '请输入子资源名称' }]}>
                                                                        <Input placeholder="例如：标准双床房" />
                                                                    </Form.Item>
                                                                    <Form.Item name={[field.name, 'resource_code']} label="子资源编码">
                                                                        <Input placeholder="例如：RES-001" />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col span={12}>
                                                                    <Form.Item
                                                                        noStyle
                                                                        shouldUpdate={(prevValues, currentValues) =>
                                                                            prevValues?.resources?.[field.name]?.is_combination !== currentValues?.resources?.[field.name]?.is_combination
                                                                        }
                                                                    >
                                                                        {({ getFieldValue }) => {
                                                                            const isCombination = !!getFieldValue(['resources', field.name, 'is_combination'])
                                                                            const resolvedType = isCombination ? COMBINATION_RESOURCE_TYPE : poiType
                                                                            return (
                                                                                <Form.Item name={[field.name, 'resource_type']} label="子资源类型" rules={[{ required: true, message: '请选择子资源类型' }]}>
                                                                                    <Select
                                                                                        placeholder="子资源类型"
                                                                                        disabled
                                                                                        options={resolvedType ? [{ value: resolvedType, label: resolvedType }] : []}
                                                                                    />
                                                                                </Form.Item>
                                                                            )
                                                                        }}
                                                                    </Form.Item>
                                                                    <Form.Item name={[field.name, 'is_combination']} label="组合资源" valuePropName="checked">
                                                                        <Switch
                                                                            checkedChildren="是"
                                                                            unCheckedChildren="否"
                                                                            onChange={(checked) => {
                                                                                if (checked) {
                                                                                    poiForm.setFieldValue(['resources', field.name, 'attrs'], undefined)
                                                                                    poiForm.setFieldValue(['resources', field.name, 'resource_type'], COMBINATION_RESOURCE_TYPE)
                                                                                } else {
                                                                                    poiForm.setFieldValue(['resources', field.name, 'combination_members'], [])
                                                                                    poiForm.setFieldValue(['resources', field.name, 'resource_type'], poiType)
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Form.Item>
                                                                </Col>
                                                            </Row>

                                                            <Form.Item
                                                                noStyle
                                                                shouldUpdate={(prevValues, currentValues) =>
                                                                    prevValues?.resources?.[field.name]?.is_combination !== currentValues?.resources?.[field.name]?.is_combination ||
                                                                    prevValues?.resources?.[field.name]?.id !== currentValues?.resources?.[field.name]?.id
                                                                }
                                                            >
                                                                {({ getFieldValue }) => {
                                                                    const isCombination = !!getFieldValue(['resources', field.name, 'is_combination'])
                                                                    const currentResourceId = Number(
                                                                        getFieldValue(['resources', field.name, 'id']) ||
                                                                        getFieldValue(['resources', field.name, 'resource_id']) ||
                                                                        0
                                                                    )
                                                                    const memberOptions = combinationMemberOptions.filter(
                                                                        option => Number(option.value) !== currentResourceId
                                                                    )
                                                                    if (isCombination) {
                                                                        return (
                                                                            <>
                                                                                <Form.Item
                                                                                    name={[field.name, 'combination_members']}
                                                                                    label="组合成员"
                                                                                    tooltip="可选择本POI或其他POI下的已创建子资源"
                                                                                    rules={[
                                                                                        ({ getFieldValue: getValue }) => ({
                                                                                            validator(_, value) {
                                                                                                const enabled = !!getValue(['resources', field.name, 'is_combination'])
                                                                                                if (!enabled) return Promise.resolve()
                                                                                                if (normalizeMemberIds(value).length >= 2) return Promise.resolve()
                                                                                                return Promise.reject(new Error('组合资源至少需要2个成员资源'))
                                                                                            },
                                                                                        }),
                                                                                    ]}
                                                                                >
                                                                                    <Select
                                                                                        mode="multiple"
                                                                                        placeholder="请选择2个或以上成员资源"
                                                                                        optionFilterProp="label"
                                                                                        showSearch
                                                                                        options={memberOptions}
                                                                                    />
                                                                                </Form.Item>
                                                                                <Form.Item style={{ marginTop: -8 }}>
                                                                                    <Button onClick={() => openMemberCreateModal(field.name, field.key)}>
                                                                                        新建成员资源
                                                                                    </Button>
                                                                                </Form.Item>
                                                                            </>
                                                                        )
                                                                    }

                                                                    return (
                                                                        <>
                                                                            {poiType === '景区' && <TicketResourceFields prefix={[field.name, 'attrs']} typeOptions={currentTypeOptions} onOptionsChange={handleTypeOptionsChange} onOptionAdd={handleTypeOptionAdd} onOptionDelete={handleTypeOptionDelete} onOptionRename={handleTypeOptionRename} />}
                                                                            {poiType === '酒店' && <HotelResourceFields prefix={[field.name, 'attrs']} typeOptions={currentTypeOptions} onOptionsChange={handleTypeOptionsChange} onOptionAdd={handleTypeOptionAdd} onOptionDelete={handleTypeOptionDelete} onOptionRename={handleTypeOptionRename} />}
                                                                            {poiType === '餐饮' && <DiningResourceFields prefix={[field.name, 'attrs']} typeOptions={currentTypeOptions} onOptionsChange={handleTypeOptionsChange} onOptionAdd={handleTypeOptionAdd} onOptionDelete={handleTypeOptionDelete} onOptionRename={handleTypeOptionRename} />}
                                                                            {poiType === '交通' && <TransportResourceFields prefix={[field.name, 'attrs']} typeOptions={currentTypeOptions} onOptionsChange={handleTypeOptionsChange} onOptionAdd={handleTypeOptionAdd} onOptionDelete={handleTypeOptionDelete} onOptionRename={handleTypeOptionRename} />}
                                                                        </>
                                                                    )
                                                                }}
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={10}>
                                                            <div style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                                                <h4 style={{ marginBottom: 8 }}>供应商绑定（可选）</h4>
                                                                <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                                                                    可先创建子资源，再视需要绑定供应商，绑定后可设置结算价。
                                                                </p>
                                                                <Form.List name={[field.name, 'supplier_bindings']}>
                                                                    {(supplierFields, { add: addSupplier, remove: removeSupplier }, { errors }) => (
                                                                        <>
                                                                            {supplierFields.map(({ key, name, ...restField }) => (
                                                                                <Space key={key} style={{ display: 'flex', marginBottom: 8, flexWrap: 'wrap', rowGap: 4 }} align="baseline">
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
                                                                                    <Form.Item
                                                                                        shouldUpdate={() => true}
                                                                                        noStyle
                                                                                    >
                                                                                        {({ getFieldValue }) => {
                                                                                            const supplierId = getFieldValue(['resources', field.name, 'supplier_bindings', name, 'supplier_id'])
                                                                                            const supplier = suppliers.find(s => String(s.id) === String(supplierId))
                                                                                            const presetKey = getPresetKey(field.name, name)
                                                                                            const agreementCount = pendingAgreements[presetKey]?.length || 0
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
                                                                                                                resourceIndex: field.name,
                                                                                                                supplierIndex: name,
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
                                                                                            removeSupplier(name)
                                                                                            setPendingAgreements(prev => {
                                                                                                const next: Record<string, any[]> = {}
                                                                                                Object.entries(prev).forEach(([k, v]) => {
                                                                                                    const parts = k.split(":")
                                                                                                    const rIdx = Number(parts[0])
                                                                                                    const sIdx = Number(parts[1])
                                                                                                    if (rIdx !== field.name) {
                                                                                                        next[k] = v
                                                                                                        return
                                                                                                    }
                                                                                                    if (sIdx < name) next[k] = v
                                                                                                    if (sIdx > name) next[`${rIdx}:${sIdx - 1}`] = v
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
                                            onClick={() => add({ resource_type: poiType, is_combination: false, combination_members: [], supplier_bindings: [] })}
                                            block
                                            icon={<PlusOutlined />}
                                        >
                                            增加一个子资源
                                        </Button>
                                    </>
                                )}
                            </Form.List>
                        </div>
                    )}

                    <div style={{ marginTop: 24, padding: 12, background: '#e6f7ff', borderRadius: 4, fontSize: 12, marginBottom: 16 }}>
                        💡 提示：子资源需要逐条点击“保存子资源”，未保存的不会创建。也可以先保存资源，稍后在详情里添加子资源。
                    </div>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => {
                                resetCreateModal()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" onClick={handleCreatePoi} loading={creatingPoi}>
                                {createdPoi ? '完成' : '创建 资源'}
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="新建组合成员资源"
                open={memberCreateModalVisible}
                onCancel={() => {
                    setMemberCreateModalVisible(false)
                    setMemberCreateTarget(null)
                    setMemberCreateType(null)
                    memberCreateForm.resetFields()
                }}
                footer={null}
                width={720}
            >
                <Form form={memberCreateForm} layout="vertical" onFinish={handleCreateCombinationMember}>
                    <Form.Item name="poi_id" label="所属资源" rules={[{ required: true, message: '请选择所属资源' }]}>
                        <Select
                            showSearch
                            optionFilterProp="label"
                            placeholder="选择资源"
                            options={memberCreatePoiOptions}
                        />
                    </Form.Item>
                    <Form.Item name="resource_name" label="成员资源名称" rules={[{ required: true, message: '请输入成员资源名称' }]}>
                        <Input placeholder="例如：标准双床房" />
                    </Form.Item>
                    <Form.Item name="resource_code" label="成员资源编码">
                        <Input placeholder="例如：RES-001" />
                    </Form.Item>
                    <Form.Item name="resource_type" label="成员资源类型" rules={[{ required: true, message: '请选择成员资源类型' }]}>
                        <Select
                            placeholder="选择类型"
                            options={POI_TYPES.map((t) => ({ value: t, label: t }))}
                            onChange={(value) => {
                                setMemberCreateType(value)
                                memberCreateForm.setFieldValue('attrs', undefined)
                            }}
                        />
                    </Form.Item>

                    {!memberCreateType && (
                        <p style={{ color: '#999', marginBottom: 12 }}>选择成员资源类型后可填写对应字段</p>
                    )}
                    {memberCreateType === '景区' && <TicketResourceFields />}
                    {memberCreateType === '酒店' && <HotelResourceFields />}
                    {memberCreateType === '餐饮' && <DiningResourceFields />}
                    {memberCreateType === '交通' && <TransportResourceFields />}

                    <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>
                        成员资源创建后会自动加入当前组合，不会自动绑定供应商。
                    </p>

                    <Form.Item style={{ marginBottom: 0 }}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button onClick={() => {
                                setMemberCreateModalVisible(false)
                                setMemberCreateTarget(null)
                                setMemberCreateType(null)
                                memberCreateForm.resetFields()
                            }}>
                                取消
                            </Button>
                            <Button type="primary" htmlType="submit">
                                创建并加入组合
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* POI 详情 Drawer */}
            {selectedPoi && (
                <POIDetailDrawer
                    poi={selectedPoi}
                    onClose={() => setSelectedPoi(null)}
                    form={poiEditForm}
                    onSave={savePoi}
                    provinceOptions={provinceOptions}
                    editCityOptions={editCityOptions}
                    editDistrictOptions={editDistrictOptions}
                    editProvince={editProvince}
                    editCity={editCity}
                    typeOptions={currentTypeOptions}
                    onOptionsChange={handleTypeOptionsChange}
                    onOptionAdd={handleTypeOptionAdd}
                    onOptionDelete={handleTypeOptionDelete}
                    onOptionRename={handleTypeOptionRename}
                    onProvinceChange={(value) => {
                        poiEditForm.setFieldsValue({ city: undefined, district: undefined })
                        setEditCityOptions([])
                        setEditDistrictOptions([])
                        loadCities(value, 'edit')
                    }}
                    onCityChange={(value) => {
                        poiEditForm.setFieldValue('district', undefined)
                        setEditDistrictOptions([])
                        loadDistricts(value, 'edit')
                    }}
                    readonly={drawerReadOnly}
                />
            )}

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

            {/* POI 详情图管理 Modal */}
            <POIFileModal
                poi={fileManagerPoi}
                open={!!fileManagerPoi}
                onClose={() => setFileManagerPoi(null)}
            />

            <PresetAgreementEditor
                visible={presetAgreementModal.visible}
                onCancel={() => setPresetAgreementModal(prev => ({ ...prev, visible: false }))}
                onSave={(agreements) => {
                    const key = getPresetKey(presetAgreementModal.resourceIndex, presetAgreementModal.supplierIndex)
                    setPendingAgreements(prev => ({
                        ...prev,
                        [key]: agreements
                    }))
                }}
                supplierName={presetAgreementModal.supplierName}
                supplierFolderId={presetAgreementModal.supplierFolderId}
                initialAgreements={pendingAgreements[getPresetKey(presetAgreementModal.resourceIndex, presetAgreementModal.supplierIndex)] || []}
            />

        </div>
    )
}
