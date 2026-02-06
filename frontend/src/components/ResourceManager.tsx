import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, Tag, Drawer, Descriptions, Card, Checkbox, Row, Col, Popconfirm, Tooltip, Switch, TreeSelect } from 'antd'
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



const BASE_RESOURCE_TYPES = ['酒店', '景区', '餐饮', '交通']
const COMBINATION_RESOURCE_TYPE = '组合'
const RESOURCE_TYPES_FOR_FILTER = [...BASE_RESOURCE_TYPES, COMBINATION_RESOURCE_TYPE]

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
    const { data, loadData } = useData()
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
    const createIsCombination = !!Form.useWatch('is_combination', form)
    const editIsCombination = !!Form.useWatch('is_combination', editForm)
    const [memberCreateForm] = Form.useForm()
    const [memberCreateModalVisible, setMemberCreateModalVisible] = useState(false)
    const [memberCreateTarget, setMemberCreateTarget] = useState<'create' | 'edit'>('create')
    const [memberCreateType, setMemberCreateType] = useState<string | null>(null)
    const dataKeys = ['poi', 'resources', 'suppliers', 'supplier_resources', 'product_resources'] as const

    useEffect(() => {
        loadData([...dataKeys])
    }, [loadData])

    const refreshData = useCallback(async () => {
        await loadData([...dataKeys], { force: true })
    }, [loadData])

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
            message.success('宸叉洿鏂板瓙璧勬簮瀛楁閫夐」')
            await refreshData()
        } catch {
            message.error('鏇存柊瀛愯祫婧愬瓧娈甸€夐」澶辫触')
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
            message.success('宸叉洿鏂板瓙璧勬簮瀛楁閫夐」')
            await refreshData()
        } catch {
            message.error('鏇存柊瀛愯祫婧愬瓧娈甸€夐」澶辫触')
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

    // 杩借釜褰撳墠閫夋嫨鐨勮祫婧愮被鍨嬶紝鐢ㄤ簬鍔ㄦ€佹樉绀哄瓧娈?
    const [resourceType, setResourceType] = useState<string | null>(null)
    // 杩借釜璧勬簮绫诲瀷鏄惁琚玃OI閿佸畾
    const [isTypeLocked, setIsTypeLocked] = useState(false)

    // 绛涢€夊櫒鐘舵€?
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
    // Pending Agreements for Edit Mode
    const [pendingEditAgreements, setPendingEditAgreements] = useState<Record<number, any[]>>({})
    const [presetEditAgreementModal, setPresetEditAgreementModal] = useState<{
        visible: boolean
        fieldIndex: number
        supplierId: number
        supplierName: string
        supplierFolderId: number | null
    }>({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })

    // 杩囨护閫昏緫
    const normalizeMemberIds = (values: any): number[] => {
        if (!Array.isArray(values)) return []
        return Array.from(new Set(values.map((id) => Number(id)).filter((id) => Number.isFinite(id))))
    }

    const getResourceMemberIds = (resource?: Resource | null): number[] => {
        if (!resource || !Array.isArray(resource.combination_members)) return []
        return resource.combination_members
            .map((member) => Number((member as any).resource_id))
            .filter((id) => Number.isFinite(id))
    }

    const combinationMemberTreeData = useMemo(() => {
        const poiNodeMap = new Map<string, {
            title: string
            value: string
            key: string
            selectable: boolean
            disableCheckbox: boolean
            children: Array<{ title: string, value: number, key: string }>
        }>()

        poiList.forEach((poi) => {
            const key = String(poi.id)
            poiNodeMap.set(key, {
                title: `${poi.poi_name} (${poi.city})`,
                value: `poi-${key}`,
                key: `poi-${key}`,
                selectable: false,
                disableCheckbox: true,
                children: [],
            })
        })

        resources.forEach((resource) => {
            const poiKey = String(resource.poi_id)
            if (!poiNodeMap.has(poiKey)) {
                poiNodeMap.set(poiKey, {
                    title: `资源 ${poiKey}`,
                    value: `poi-${poiKey}`,
                    key: `poi-${poiKey}`,
                    selectable: false,
                    disableCheckbox: true,
                    children: [],
                })
            }
            const displayType = resource.is_combination ? COMBINATION_RESOURCE_TYPE : resource.resource_type
            poiNodeMap.get(poiKey)!.children.push({
                title: `${resource.resource_name} (${displayType})`,
                value: Number(resource.id),
                key: `resource-${resource.id}`,
            })
        })

        return Array.from(poiNodeMap.values())
            .map((poiNode) => ({
                ...poiNode,
                children: [...poiNode.children].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN')),
            }))
            .filter((poiNode) => poiNode.children.length > 0)
            .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
    }, [resources, poiList])

    const editCombinationMemberTreeData = useMemo(() => {
        if (!selectedResource) return combinationMemberTreeData
        const selfId = Number(selectedResource.id)
        return combinationMemberTreeData
            .map((poiNode) => ({
                ...poiNode,
                children: poiNode.children.filter((child) => Number(child.value) !== selfId),
            }))
            .filter((poiNode) => poiNode.children.length > 0)
    }, [combinationMemberTreeData, selectedResource])

    const openMemberCreateModal = (target: 'create' | 'edit') => {
        const resolvedPoiId = target === 'create'
            ? (poiId ?? form.getFieldValue('poi_id'))
            : (poiId ?? editForm.getFieldValue('poi_id') ?? selectedResource?.poi_id)
        if (!resolvedPoiId) {
            message.warning('请先选择所属资源')
            return
        }
        setMemberCreateTarget(target)
        setMemberCreateType(null)
        memberCreateForm.resetFields()
        memberCreateForm.setFieldsValue({
            poi_id: Number(resolvedPoiId),
            is_combination: false,
        })
        setMemberCreateModalVisible(true)
    }

    const handleCreateCombinationMember = async (values: any) => {
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
            await refreshData()

            const targetForm = memberCreateTarget === 'create' ? form : editForm
            const current = normalizeMemberIds(targetForm.getFieldValue('combination_members'))
            targetForm.setFieldValue('combination_members', Array.from(new Set([...current, Number(created.id)])))

            message.success('成员资源已创建并加入组合')
            setMemberCreateModalVisible(false)
            setMemberCreateType(null)
            memberCreateForm.resetFields()
        } catch (err: any) {
            message.error(err?.message || '成员资源创建失败')
        }
    }

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
        const shouldLock = BASE_RESOURCE_TYPES.includes(fixedPoiType)
        setIsTypeLocked(shouldLock)
        setResourceType(fixedPoiType)
        form.setFieldsValue({
            poi_id: fixedPoi?.id ?? poiId,
            resource_type: fixedPoiType,
            attrs: undefined,
            is_combination: false,
            combination_members: [],
        })
    }, [poiId, fixedPoiType, fixedPoi, createModalVisible, form])


    // 鍒涘缓璧勬簮骞跺彲缁戝畾渚涘簲鍟?
    const handleCreateResource = async (values: any) => {
        try {
            const resolvedPoiId = poiId ?? values.poi_id
            if (!resolvedPoiId) {
                message.warning('请选择资源')
                return
            }
            const isCombination = !!values.is_combination
            const resolvedResourceType = isCombination ? COMBINATION_RESOURCE_TYPE : (resourceType ?? values.resource_type)
            const memberIds = normalizeMemberIds(values.combination_members)
            if (isCombination && memberIds.length < 2) {
                message.warning('组合资源至少需要 2 个成员资源')
                return
            }
            // 1. 鍏堝垱寤鸿祫婧?
            const resourcePayload: any = {
                poi_id: resolvedPoiId,
                resource_name: values.resource_name,
                resource_code: values.resource_code,
                resource_type: resolvedResourceType,
                is_combination: isCombination,
                combination_members: isCombination ? memberIds : [],
                status: 'active',
            }

            // 2. 娣诲姞鐗瑰畾绫诲瀷鐨刟ttrs瀛楁锛堟櫙鍖?閰掑簵鐨勮缁嗕俊鎭級
            if (!isCombination && values.attrs) {
                resourcePayload.attrs = values.attrs
            }

            const newResource = await apiRequest<{ id: string }>('/api/resources', {
                method: 'POST',
                body: JSON.stringify(resourcePayload),
            })

            // 3. 鍐嶅垱寤轰緵搴斿晢-璧勬簮缁戝畾鍏崇郴锛堝彲閫夛級
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

            message.success('子资源创建成功')
            if (agreementErrors.length > 0) {
                message.warning(`子资源已创建，但有 ${agreementErrors.length} 份协议创建失败`)
            }
            setCreateModalVisible(false)
            form.resetFields()
            setResourceType(null) // 閲嶇疆璧勬簮绫诲瀷
            setIsTypeLocked(false)
            setPendingAgreements({})
            setPresetAgreementModal({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })
            await refreshData()
        } catch (err: any) {
            if (err.message?.includes('duplicate')) {
                message.warning('该资源下已存在同名同类型的子资源')
            } else {
                message.error(err.message || '创建失败')
            }
        }
    }

    const handleUpdateResource = async (values: any) => {
        if (!selectedResource) return
        try {
            const isCombination = !!values.is_combination
            const memberIds = normalizeMemberIds(values.combination_members)
            if (isCombination && memberIds.length < 2) {
                message.warning('组合资源至少需要 2 个成员资源')
                return
            }
            const previousMemberIds = getResourceMemberIds(selectedResource)
            // 1. 鏇存柊璧勬簮鍩烘湰淇℃伅
            const resourcePayload: any = {
                poi_id: poiId ?? values.poi_id,
                resource_name: values.resource_name,
                resource_code: values.resource_code,
                is_combination: isCombination,
                combination_members: isCombination ? memberIds : [],
                status: values.status,
            }

            // 娣诲姞attrs瀛楁锛堟櫙鍖?閰掑簵鐗瑰畾淇℃伅锛?
            if (!isCombination && values.attrs) {
                resourcePayload.attrs = values.attrs
            }

            // 妫€鏌ヨ祫婧愬熀鏈俊鎭垨attrs鏄惁鏈夊彉鍖?
            const hasBasicChange =
                selectedResource.poi_id !== resourcePayload.poi_id ||
                selectedResource.resource_name !== resourcePayload.resource_name ||
                selectedResource.resource_code !== resourcePayload.resource_code ||
                selectedResource.status !== resourcePayload.status ||
                selectedResource.is_combination !== isCombination ||
                JSON.stringify([...previousMemberIds].sort((a, b) => a - b)) !== JSON.stringify([...memberIds].sort((a, b) => a - b)) ||
                JSON.stringify(selectedResource.attrs) !== JSON.stringify(resourcePayload.attrs)

            if (hasBasicChange) {
                await apiRequest(`/api/resources/${selectedResource.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(resourcePayload)
                })
            }

            // 2. 澶勭悊渚涘簲鍟嗙粦瀹?
            // 鑾峰彇鐜版湁缁戝畾
            const existingBindings = getResourceSuppliers(selectedResource.id)
            const newBindings = values.supplier_bindings || []
            const agreementErrors: string[] = []

            // 鎵惧嚭闇€瑕佸垹闄ょ殑缁戝畾锛堝湪鐜版湁鍒楄〃涓絾涓嶅湪鏂板垪琛ㄤ腑锛?
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

            // 澶勭悊鏂板鎴栨洿鏂扮殑缁戝畾
            for (let i = 0; i < newBindings.length; i += 1) {
                const binding = newBindings[i]
                const existingBinding = existingBindings.find((eb: any) =>
                    Number(eb.supplier_id) === Number(binding.supplier_id)
                )

                if (existingBinding) {
                    // 鏇存柊缁撶畻浠?
                    if (existingBinding.settlement_price !== binding.settlement_price) {
                        await apiRequest(`/api/supplier-resources/${existingBinding.id}/adjust-price`, {
                            method: 'POST',
                            body: JSON.stringify({
                                settlement_price: binding.settlement_price,
                                reason: '子资源编辑时修改结算价',
                            })
                        })
                    }
                } else {
                    // 鍒涘缓鏂扮粦瀹?
                    const createdBinding = await apiRequest<{ id: number }>('/api/supplier-resources', {
                        method: 'POST',
                        body: JSON.stringify({
                            supplier_id: binding.supplier_id,
                            resource_id: selectedResource.id,
                            settlement_price: binding.settlement_price,
                            supply_status: 'active',
                        })
                    })

                    const presetList = pendingEditAgreements[i] || []
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
            }

            message.success('子资源已更新')
            if (agreementErrors.length > 0) {
                message.warning(`子资源已更新，但有 ${agreementErrors.length} 份协议创建失败`)
            }
            setEditModalVisible(false)
            setSelectedResource(null)
            setResourceType(null) // 閲嶇疆璧勬簮绫诲瀷
            setPendingEditAgreements({})
            setPresetEditAgreementModal({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })
            await refreshData()
        } catch (err: any) {
            message.error(err.message || '更新失败')
        }
    }

    const deleteResource = async (id: string) => {
        try {
            await apiRequest(`/api/resources/${id}`, { method: 'DELETE' })
            message.success('子资源已删除')
            await refreshData()
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
            message.success(`已删除 ${selectedRowKeys.length} 个子资源`)
            setSelectedRowKeys([])
            await refreshData()
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
            message.success(`已更新 ${selectedRowKeys.length} 个子资源`)
            setBatchUpdateVisible(false)
            batchUpdateForm.resetFields()
            setSelectedRowKeys([])
            await refreshData()
        } catch (err: any) {
            message.error(err.message || '批量更新失败')
        }
    }

    const handleSaveInventory = async () => {
        if (!selectedResource || !selectedSupplierId) {
            message.warning('请选择供应商')
            return
        }
        // Find supplier resource id
        const sr = supplierResources.find(
            s => (s.resource_id as unknown as number) === Number(selectedResource.id) && (s.supplier_id as unknown as number) === selectedSupplierId
        )
        if (!sr) {
            message.error('未找到供应商绑定信息')
            return
        }

        if (calendarRef.current) {
            await calendarRef.current.saveToBackend(Number(sr.id))
            setInventoryModalVisible(false)
            message.success('库存保存成功')
        }
    }

    // 鑾峰彇璧勬簮鍏宠仈鐨勪緵搴斿晢鍒楄〃
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
            title: '子资源名称',
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
            title: '子资源类型',
            dataIndex: 'resource_type',
            render: (v: string, record: Resource) => {
                const displayType = record.is_combination ? COMBINATION_RESOURCE_TYPE : v
                return <Tag color={record.is_combination ? 'purple' : 'blue'}>{displayType}</Tag>
            },
            filters: RESOURCE_TYPES_FOR_FILTER.map(t => ({ text: t, value: t })),
            onFilter: (value: string, record: Resource) => record.resource_type === value,
        },
        {
            title: '关联资源',
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
                                <span>{b.settlement_price ? `￥${b.settlement_price}` : '-'}</span>
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
                                  // 璁剧疆璧勬簮绫诲瀷浠ユ樉绀哄搴斿瓧娈?
                                  setResourceType(record.is_combination ? COMBINATION_RESOURCE_TYPE : record.resource_type)
                                  // 鑾峰彇鐜版湁渚涘簲鍟嗙粦瀹氫俊鎭?
                                  const existingBindings = getResourceSuppliers(record.id).map(sr => ({
                                      supplier_id: sr.supplier_id,
                                      settlement_price: sr.settlement_price,
                                      binding_id: sr.id
                                  }))
                                  editForm.setFieldsValue({
                                      ...record,
                                      resource_type: record.is_combination ? COMBINATION_RESOURCE_TYPE : record.resource_type,
                                      is_combination: !!record.is_combination,
                                      combination_members: getResourceMemberIds(record),
                                      supplier_bindings: existingBindings.length > 0 ? existingBindings : []
                                  })
                                  setPendingEditAgreements({})
                                  setPresetEditAgreementModal({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })
                                  setEditModalVisible(true)
                              }}
                          >
                            编辑
                        </Button>
                        {isLocked ? (
                            <Tooltip title="该子资源已被产品使用，不可删除">
                                <Button type="link" danger disabled size="small" icon={<DeleteOutlined />}>
                                    删除
                                </Button>
                            </Tooltip>
                        ) : (
                            <Popconfirm
                                title="确定删除该子资源吗？"
                                description="删除子资源会同时删除所有关联的供应商绑定信息"
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
                        <h1 className="page-title">子资源管理</h1>
                        <p className="page-subtitle">管理所有子资源，可按需绑定供应商与结算价</p>
                    </div>
                    <Space>

                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                            新建子资源
                        </Button>
                    </Space>
                </div>
            )}
            {isEmbedded && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>子资源列表</h3>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                        新建子资源
                    </Button>
                </div>
            )}

            {/* 楂樼骇绛涢€夊櫒 */}
            {!isEmbedded && (
                <Card size="small" style={{ marginBottom: 16 }} bodyStyle={{ padding: '16px' }}>
                    <Form layout="inline" style={{ width: '100%' }}>
                        <Row gutter={[16, 16]} style={{ width: '100%' }}>
                            <Col span={6}>
                                <Form.Item label="关键字" style={{ marginBottom: 0, width: '100%' }}>
                                    <Input
                                        placeholder="搜索子资源名称"
                                        prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                                        value={filters.keyword}
                                        onChange={e => setFilters({ ...filters, keyword: e.target.value })}
                                        allowClear
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label="关联资源" style={{ marginBottom: 0, width: '100%' }}>
                                    <Select
                                        placeholder="全部资源"
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
                                            title={`确定删除选中的 ${selectedRowKeys.length} 个子资源吗？`}
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
                                <Form.Item label="子资源类型" style={{ marginBottom: 0 }}>
                                    <Checkbox.Group
                                        options={RESOURCE_TYPES_FOR_FILTER}
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

            {/* 鍒涘缓瀛愯祫婧怣odal */}
            <Modal
                title="创建子资源"
                open={createModalVisible}
                onCancel={() => {
                    setCreateModalVisible(false)
                    form.resetFields()
                    setResourceType(null) // 閲嶇疆璧勬簮绫诲瀷
                    setIsTypeLocked(false)
                    setPendingAgreements({})
                    setPresetAgreementModal({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })
                }}
                footer={null}
                width={720}
            >
                {/* ... existing form content ... */}
                <Form form={form} layout="vertical" onFinish={handleCreateResource} initialValues={{ is_combination: false }}>
                    <Form.Item name="poi_id" label="所属资源" rules={[{ required: true, message: '请选择资源' }]}>
                        <Select
                            placeholder="选择资源"
                            showSearch
                            allowClear={!poiId}
                            optionFilterProp="label"
                            disabled={Boolean(poiId)}
                            options={poiList.map((p) => ({ value: p.id, label: `${p.poi_name} (${p.city})` }))}
                            onChange={(value) => {
                                if (!value) {
                                    setIsTypeLocked(false)
                                    setResourceType(null)
                                    form.setFieldsValue({ resource_type: undefined, attrs: undefined, is_combination: false, combination_members: [] })
                                    return
                                }
                                const selectedPoi = poiList.find(p => p.id === value)
                                if (selectedPoi && selectedPoi.poi_type && BASE_RESOURCE_TYPES.includes(selectedPoi.poi_type)) {
                                    const shouldLock = true
                                    setIsTypeLocked(shouldLock)
                                    setResourceType(selectedPoi.poi_type)
                                    form.setFieldsValue({
                                        resource_type: selectedPoi.poi_type,
                                        attrs: undefined,
                                        is_combination: false,
                                        combination_members: [],
                                    })
                                } else {
                                    setIsTypeLocked(false)
                                }
                            }}
                        />
                    </Form.Item>
                    <Form.Item name="resource_name" label="子资源名称" rules={[{ required: true, message: '请输入子资源名称' }]}>
                        <Input placeholder="例如：标准双床房" />
                    </Form.Item>
                    <Form.Item name="resource_code" label="子资源编码">
                        <Input placeholder="例如：RES-001" />
                    </Form.Item>
                    <Form.Item name="resource_type" label="子资源类型" rules={[{ required: true, message: '请选择子资源类型' }]}>
                        <Select
                            placeholder="选择类型"
                            disabled={createIsCombination || isTypeLocked || Boolean(poiId)}
                            options={[...BASE_RESOURCE_TYPES, COMBINATION_RESOURCE_TYPE].map((t) => ({ value: t, label: t }))}
                            onChange={(value) => {
                                setResourceType(value)
                                // 娓呴櫎涔嬪墠鐨刟ttrs瀛楁
                                form.setFieldValue('attrs', undefined)
                            }}
                        />
                    </Form.Item>

                    <Form.Item name="is_combination" label="组合资源" valuePropName="checked">
                        <Switch
                            checkedChildren="是"
                            unCheckedChildren="否"
                            onChange={(checked) => {
                                if (checked) {
                                    setResourceType(COMBINATION_RESOURCE_TYPE)
                                    form.setFieldsValue({
                                        resource_type: COMBINATION_RESOURCE_TYPE,
                                        attrs: undefined,
                                    })
                                } else {
                                    const resolvedPoiId = poiId ?? form.getFieldValue('poi_id')
                                    const selectedPoi = poiList.find((p) => String(p.id) === String(resolvedPoiId))
                                    const inheritedType = selectedPoi?.poi_type
                                    setResourceType(inheritedType || null)
                                    form.setFieldsValue({
                                        resource_type: inheritedType,
                                        combination_members: [],
                                    })
                                }
                            }}
                        />
                    </Form.Item>
                    {createIsCombination && (
                        <>
                            <Form.Item
                                name="combination_members"
                                label="组合成员"
                                rules={[{
                                    validator: async (_rule, value) => {
                                        const ids = normalizeMemberIds(value)
                                        if (ids.length < 2) {
                                            throw new Error('组合资源至少需要 2 个成员资源')
                                        }
                                    }
                                }]}
                            >
                                <TreeSelect
                                    treeData={combinationMemberTreeData}
                                    treeCheckable
                                    showCheckedStrategy={TreeSelect.SHOW_CHILD}
                                    showSearch
                                    allowClear
                                    maxTagCount="responsive"
                                    placeholder="选择组合成员资源（资源 -> 子资源，可跨POI）"
                                    filterTreeNode={(input, node) =>
                                        String(node.title ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                />
                            </Form.Item>
                            <Form.Item>
                                <Button onClick={() => openMemberCreateModal('create')}>
                                    新建成员资源
                                </Button>
                            </Form.Item>
                        </>
                    )}

                    {!createIsCombination && resourceType === '景区' && (
                        <TicketResourceFields
                            typeOptions={getFormOptions(createFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(createFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(createFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(createFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(createFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {!createIsCombination && resourceType === '酒店' && (
                        <HotelResourceFields
                            typeOptions={getFormOptions(createFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(createFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(createFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(createFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(createFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {!createIsCombination && resourceType === '餐饮' && (
                        <DiningResourceFields
                            typeOptions={getFormOptions(createFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(createFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(createFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(createFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(createFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {!createIsCombination && resourceType === '交通' && (
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
                            可先创建子资源，再按需绑定供应商。同一子资源可以绑定多个供应商，每个供应商有独立结算价。
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
                                创建子资源
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>



            {/* 缂栬緫瀛愯祫婧怣odal */}
            <Modal
                title={`编辑子资源 ${selectedResource?.resource_name}`}
                open={editModalVisible}
                onCancel={() => {
                    setEditModalVisible(false)
                    setSelectedResource(null)
                    editForm.resetFields()
                    setResourceType(null) // 閲嶇疆璧勬簮绫诲瀷
                    setPendingEditAgreements({})
                    setPresetEditAgreementModal({ visible: false, fieldIndex: -1, supplierId: 0, supplierName: '', supplierFolderId: null })
                }}
                footer={null}
                width={720}
            >
                <Form form={editForm} layout="vertical" onFinish={handleUpdateResource}>
                    <Form.Item name="poi_id" label="所属资源" rules={[{ required: true, message: '请选择资源' }]}>
                        <Select
                            placeholder="选择资源"
                            showSearch
                            optionFilterProp="label"
                            disabled={Boolean(poiId)}
                            options={poiList.map((p) => ({ value: p.id, label: `${p.poi_name} (${p.city})` }))}
                        />
                    </Form.Item>
                    <Form.Item name="resource_name" label="子资源名称" rules={[{ required: true, message: '请输入子资源名称' }]}>
                        <Input placeholder="例如：标准双床房" />
                    </Form.Item>
                    <Form.Item name="resource_code" label="子资源编码">
                        <Input placeholder="例如：RES-001" />
                    </Form.Item>
                    <Form.Item name="resource_type" label="子资源类型" rules={[{ required: true, message: '请选择子资源类型' }]}>
                        <Select
                            placeholder="选择类型"
                            disabled
                            options={[...BASE_RESOURCE_TYPES, COMBINATION_RESOURCE_TYPE].map((t) => ({ value: t, label: t }))}
                        />
                    </Form.Item>
                    <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                        <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
                    </Form.Item>

                    <Form.Item name="is_combination" label="组合资源" valuePropName="checked">
                        <Switch
                            checkedChildren="是"
                            unCheckedChildren="否"
                            onChange={(checked) => {
                                if (checked) {
                                    setResourceType(COMBINATION_RESOURCE_TYPE)
                                    editForm.setFieldsValue({
                                        resource_type: COMBINATION_RESOURCE_TYPE,
                                        attrs: undefined,
                                    })
                                } else {
                                    const resolvedPoiId = poiId ?? editForm.getFieldValue('poi_id')
                                    const selectedPoi = poiList.find((p) => String(p.id) === String(resolvedPoiId))
                                    const inheritedType = selectedPoi?.poi_type
                                    setResourceType(inheritedType || null)
                                    editForm.setFieldsValue({
                                        resource_type: inheritedType,
                                        combination_members: [],
                                    })
                                }
                            }}
                        />
                    </Form.Item>
                    {editIsCombination && (
                        <>
                            <Form.Item
                                name="combination_members"
                                label="组合成员"
                                rules={[{
                                    validator: async (_rule, value) => {
                                        const ids = normalizeMemberIds(value)
                                        if (ids.length < 2) {
                                            throw new Error('组合资源至少需要 2 个成员资源')
                                        }
                                    }
                                }]}
                            >
                                <TreeSelect
                                    treeData={editCombinationMemberTreeData}
                                    treeCheckable
                                    showCheckedStrategy={TreeSelect.SHOW_CHILD}
                                    showSearch
                                    allowClear
                                    maxTagCount="responsive"
                                    placeholder="选择组合成员资源（资源 -> 子资源，可跨POI）"
                                    filterTreeNode={(input, node) =>
                                        String(node.title ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                />
                            </Form.Item>
                            <Form.Item>
                                <Button onClick={() => openMemberCreateModal('edit')}>
                                    新建成员资源
                                </Button>
                            </Form.Item>
                        </>
                    )}

                    {/* 鏍规嵁璧勬簮绫诲瀷鍔ㄦ€佹樉绀虹壒瀹氬瓧娈?*/}
                    {!editIsCombination && resourceType === '景区' && (
                        <TicketResourceFields
                            typeOptions={getFormOptions(editFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(editFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(editFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(editFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(editFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {!editIsCombination && resourceType === '酒店' && (
                        <HotelResourceFields
                            typeOptions={getFormOptions(editFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(editFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(editFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(editFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(editFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {!editIsCombination && resourceType === '餐饮' && (
                        <DiningResourceFields
                            typeOptions={getFormOptions(editFormPoiId)}
                            onOptionsChange={(field, opts) => updatePoiOptionsChange(editFormPoiId, field, opts)}
                            onOptionAdd={(field, val) => updatePoiOptions(editFormPoiId, field, 'add', val)}
                            onOptionDelete={(field, val) => updatePoiOptions(editFormPoiId, field, 'delete', val)}
                            onOptionRename={(field, oldVal, newVal) => updatePoiOptions(editFormPoiId, field, 'rename', oldVal, newVal)}
                        />
                    )}
                    {!editIsCombination && resourceType === '交通' && (
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
                            管理子资源的供应商与结算价。修改结算价会自动写入价格调整记录。
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
                                                    const supplier = suppliers.find(s => String(s.id) === String(supplierId))
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
                                                    const agreementCount = pendingEditAgreements[name]?.length || 0
                                                    const disabled = !supplierId
                                                    return (
                                                        <Tooltip title={disabled ? '请先选择供应商' : '预设协议'}>
                                                            <Button
                                                                type="link"
                                                                size="small"
                                                                disabled={disabled}
                                                                onClick={() => {
                                                                    if (disabled) return
                                                                    setPresetEditAgreementModal({
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

                                            <Form.Item name={[name, 'binding_id']} hidden>
                                                <Input />
                                            </Form.Item>

                                            <Button
                                                type="link"
                                                danger
                                                onClick={() => {
                                                    remove(name)
                                                    setPendingEditAgreements(prev => {
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

            {/* 鎵归噺鏇存柊 Modal */}
            <Modal
                title={`批量修改已选的 ${selectedRowKeys.length} 个子资源`}
                open={batchUpdateVisible}
                onCancel={() => setBatchUpdateVisible(false)}
                footer={null}
            >
                <Form layout="vertical" form={batchUpdateForm} onFinish={handleBatchUpdate}>
                    <p style={{ color: '#999', marginBottom: 16 }}>
                        请填写需要修改的字段，留空则不修改。
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

            {/* 搴撳瓨鏃ュ巻 Modal */}
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
                            <span style={{ marginRight: 8, fontWeight: 'bold' }}>选择供应商</span>
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
                            {!selectedSupplierId && <span style={{ color: 'red', marginLeft: 8 }}>请先选择供应商，再编辑日历库存与价格</span>}
                        </div>
                        <p style={{ color: '#666', marginBottom: 8 }}>
                            请在日历编辑器中填写时间段、总量和结算价，支持批量设置启用日和禁用日。
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


            {/* 瀛愯祫婧愯鎯匘rawer */}
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
                            <Descriptions.Item label="子资源名称">{selectedResource.resource_name}</Descriptions.Item>
                            <Descriptions.Item label="子资源编码">{selectedResource.resource_code || '-'}</Descriptions.Item>
                            <Descriptions.Item label="子资源类型">
                                <Tag color={selectedResource.is_combination ? 'purple' : 'blue'}>
                                    {selectedResource.is_combination ? COMBINATION_RESOURCE_TYPE : selectedResource.resource_type}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="关联资源">
                                {poiList.find((p) => p.id === selectedResource.poi_id)?.poi_name || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Tag color={selectedResource.status === 'active' ? 'green' : 'gray'}>
                                    {selectedResource.status === 'active' ? '启用' : selectedResource.status === 'inactive' ? '停用' : selectedResource.status || '启用'}
                                </Tag>
                            </Descriptions.Item>
                        </Descriptions>

                        {selectedResource.is_combination && (
                            <>
                                <h4 style={{ marginBottom: 12 }}>组合成员</h4>
                                <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 16 }}>
                                    {(selectedResource.combination_members || []).map((member: any) => (
                                        <div key={`${member.resource_id}-${member.resource_name}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Tag color={member.is_combination ? 'purple' : 'blue'}>
                                                {member.is_combination ? '组合' : member.resource_type}
                                            </Tag>
                                            <span>{member.resource_name}</span>
                                        </div>
                                    ))}
                                    {(!selectedResource.combination_members || selectedResource.combination_members.length === 0) && (
                                        <span style={{ color: '#999' }}>-</span>
                                    )}
                                </Space>
                            </>
                        )}

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
                                    render: (v: number) => v ? `￥${v}` : '-'
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

            <Modal
                title="新建组合成员资源"
                open={memberCreateModalVisible}
                onCancel={() => {
                    setMemberCreateModalVisible(false)
                    setMemberCreateType(null)
                    memberCreateForm.resetFields()
                }}
                footer={null}
                width={680}
            >
                <Form form={memberCreateForm} layout="vertical" onFinish={handleCreateCombinationMember}>
                    <Form.Item name="poi_id" label="所属资源" rules={[{ required: true, message: '请选择所属资源' }]}>
                        <Select
                            showSearch
                            optionFilterProp="label"
                            options={poiList.map((p) => ({ value: p.id, label: `${p.poi_name} (${p.city})` }))}
                        />
                    </Form.Item>
                    <Form.Item name="resource_name" label="成员资源名称" rules={[{ required: true, message: '请输入成员资源名称' }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="resource_code" label="成员资源编码">
                        <Input />
                    </Form.Item>
                    <Form.Item name="resource_type" label="成员资源类型" rules={[{ required: true, message: '请选择成员资源类型' }]}>
                        <Select
                            options={BASE_RESOURCE_TYPES.map((t) => ({ value: t, label: t }))}
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

                    <p style={{ color: '#666', fontSize: 12 }}>
                        该成员资源创建后会自动加入当前组合，不会自动绑定供应商。
                    </p>

                    <Form.Item style={{ marginBottom: 0, marginTop: 20 }}>
                        <Space style={{ float: 'right' }}>
                            <Button onClick={() => {
                                setMemberCreateModalVisible(false)
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

            <PresetAgreementEditor
                visible={presetEditAgreementModal.visible}
                onCancel={() => setPresetEditAgreementModal(prev => ({ ...prev, visible: false }))}
                onSave={(agreements) => {
                    setPendingEditAgreements(prev => ({
                        ...prev,
                        [presetEditAgreementModal.fieldIndex]: agreements
                    }))
                }}
                supplierName={presetEditAgreementModal.supplierName}
                supplierFolderId={presetEditAgreementModal.supplierFolderId}
                initialAgreements={pendingEditAgreements[presetEditAgreementModal.fieldIndex] || []}
            />
        </div >
    )
}
