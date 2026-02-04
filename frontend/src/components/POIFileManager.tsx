/**
 * POI文件管理组件
 * 用于POI详情图的上传、查看和管理
 * 套用现有的文件系统，使用POI专属文件夹
 */
import { useState, useEffect, useMemo } from 'react'
import { Upload, Button, Image, Space, message, Modal, Spin, Empty, Card, Breadcrumb, Input, Checkbox, Popconfirm, Tree, Dropdown } from 'antd'
import {
    UploadOutlined,
    DeleteOutlined,
    EyeOutlined,
    DownloadOutlined,
    FolderAddOutlined,
    FolderOutlined,
    HomeOutlined,
    ArrowLeftOutlined,
    FileOutlined,
    FileWordOutlined,
    FileExcelOutlined,
    FilePdfOutlined,
    FilePptOutlined,
    FileTextOutlined,
    VideoCameraOutlined,
    ScissorOutlined,
    EditOutlined,
    CloudDownloadOutlined,
    MoreOutlined,
    FileZipOutlined
} from '@ant-design/icons'
import type { UploadProps, TreeProps } from 'antd'
import { getToken, apiRequest, api, handleAuthExpiredResponse } from '@/lib/api'

interface POIFileManagerProps {
    poiFolderId: number | null
    poiName?: string
    entityLabel?: string
    /** 是否只读模式 */
    readonly?: boolean
    /** 模式：管理(默认) | 选择 */
    mode?: 'manage' | 'select'
    /** 选择模式下的回调 */
    onSelectionChange?: (selectedFiles: FileItem[]) => void
    /** 初始选中的文件对象 */
    defaultSelectedFiles?: FileItem[]
}

interface FileItem {
    id: number
    filename: string
    object_name: string
    url: string
    size: number
    content_type: string
    folder_id: number | null
    created_at: string
}

interface FolderItem {
    id: number
    name: string
    parent_id: number | null
    created_at: string
}

interface BreadcrumbItem {
    id: number
    name: string
}

export default function POIFileManager({
    poiFolderId,
    entityLabel = '资源',
    readonly = false,
    mode = 'manage',
    onSelectionChange,
    defaultSelectedFiles = []
}: POIFileManagerProps) {
    const [files, setFiles] = useState<FileItem[]>([])
    const [folders, setFolders] = useState<FolderItem[]>([])
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])

    // 文件夹操作状态
    const [newFolderModal, setNewFolderModal] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')

    // 高级功能状态
    const [allFolders, setAllFolders] = useState<FolderItem[]>([])
    const [renameModal, setRenameModal] = useState<{ open: boolean, folder?: FolderItem, file?: FileItem, name?: string }>({ open: false })
    const [moveFileModal, setMoveFileModal] = useState<{ open: boolean, fileIds: number[] }>({ open: false, fileIds: [] })
    const [moveFolderModal, setMoveFolderModal] = useState<{ open: boolean, folderIds: number[] }>({ open: false, folderIds: [] })
    const [previewModal, setPreviewModal] = useState<{ open: boolean, file?: FileItem }>({ open: false })
    const [treeExpandedKeys, setTreeExpandedKeys] = useState<(string | number)[]>([])

    // 选中状态
    const [selectedFilesMap, setSelectedFilesMap] = useState<Map<number, FileItem>>(() => {
        const map = new Map<number, FileItem>()
        defaultSelectedFiles.forEach(f => map.set(f.id, f))
        return map
    })
    const [selectedFileIds, setSelectedFileIds] = useState<number[]>(() => defaultSelectedFiles.map(f => f.id))
    const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([])

    // 初始化已选文件Map(如果提供了默认ID，我们也只能等加载到文件时才能填充Map，或者让调用方传入完整对象)
    // 简化起见，我们假设初始只要ID正确，后续用户操作会填充Map

    // 通知父组件选中变化
    useEffect(() => {
        if (mode === 'select' && onSelectionChange) {
            onSelectionChange(Array.from(selectedFilesMap.values()))
        }
    }, [selectedFilesMap])

    const toggleFileSelection = (file: FileItem) => {
        const newMap = new Map(selectedFilesMap)
        if (newMap.has(file.id)) {
            newMap.delete(file.id)
            setSelectedFileIds(prev => prev.filter(id => id !== file.id))
        } else {
            newMap.set(file.id, file)
            setSelectedFileIds(prev => [...prev, file.id])
        }
        setSelectedFilesMap(newMap)
    }

    // 初始化当前文件夹ID
    useEffect(() => {
        if (poiFolderId && currentFolderId === null) {
            setCurrentFolderId(poiFolderId)
        }
    }, [poiFolderId])


    // 加载内容
    const loadContents = async (folderId: number | null) => {
        if (!folderId) return

        setLoading(true)
        if (mode !== 'select') {
            setSelectedFileIds([])
        }
        setSelectedFolderIds([])

        try {
            const [foldersRes, filesRes] = await Promise.all([
                apiRequest<FolderItem[]>(`/api/files/folders?parent_id=${folderId}`),
                apiRequest<FileItem[]>(`/api/files/list?folder_id=${folderId}`)
            ])
            setFolders(foldersRes || [])
            setFiles(filesRes || [])
        } catch (error: any) {
            console.error('加载失败:', error)
            message.error('加载内容失败')
        } finally {
            setLoading(false)
        }
    }

    // 加载面包屑
    const loadBreadcrumb = async (folderId: number | null) => {
        if (!folderId || folderId === poiFolderId) {
            setBreadcrumb([])
            return
        }
        try {
            // 注意：这里需要自行处理面包屑，因为API返回的是完整路径
            // 简单起见，我们暂不处理复杂的面包屑过滤，直接显示API返回的面包屑
            // 理想情况下，应该过滤掉 poiFolderId 及其父级
            const res = await api.get(`/files/folders/${folderId}/path`)

            // 找到截断点：从 poiFolderId 开始截取
            const fullPath = res.data as BreadcrumbItem[]
            const rootIndex = fullPath.findIndex(item => item.id === poiFolderId)
            if (rootIndex !== -1) {
                setBreadcrumb(fullPath.slice(rootIndex + 1))
            } else {
                setBreadcrumb([])
            }
        } catch (error) {
            console.error(error)
        }
    }

    useEffect(() => {
        if (currentFolderId) {
            loadContents(currentFolderId)
            loadBreadcrumb(currentFolderId)
        }
    }, [currentFolderId])

    const handleUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options
        setUploading(true)
        const formData = new FormData()
        formData.append('files', file as File)

        try {
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const url = `${apiBase}/api/files/upload${currentFolderId ? `?folder_id=${currentFolderId}` : ''}`

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            })
            if (handleAuthExpiredResponse(response)) {
                throw new Error('登录已过期，请重新登录')
            }

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.detail || '上传失败')
            }

            message.success('上传成功')
            onSuccess?.(result)
            loadContents(currentFolderId)
        } catch (error: any) {
            console.error('上传出错:', error)
            message.error(error.message || '上传失败')
            onError?.(error)
        } finally {
            setUploading(false)
        }
    }

    const isImage = (contentType: string) => contentType?.startsWith('image/')

    const isWordDoc = (file: FileItem) => {
        const contentType = (file.content_type || '').toLowerCase()
        if (
            contentType === 'application/msword' ||
            contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
            return true
        }
        const filename = (file.filename || '').toLowerCase()
        return filename.endsWith('.doc') || filename.endsWith('.docx')
    }

    const canPreview = (file: FileItem) => isImage(file.content_type) || isWordDoc(file)

    const getWordPreviewUrl = (url: string) =>
        `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

    const openPreview = (file: FileItem) => {
        if (!canPreview(file)) {
            message.warning('该文件暂不支持预览')
            return
        }
        setPreviewModal({ open: true, file })
    }

    const loadAllFolders = async () => {
        try {
            const res = await api.get<FolderItem[]>('/files/folders')
            setAllFolders(res.data)
        } catch (error) {
            console.error(error)
        }
    }

    const renameFolder = async () => {
        if (!renameModal.folder || !renameModal.name?.trim()) return
        try {
            await api.put(`/files/folders/${renameModal.folder.id}?name=${encodeURIComponent(renameModal.name.trim())}`)
            message.success('重命名成功')
            setRenameModal({ open: false })
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '重命名失败')
        }
    }

    const batchDownloadFolders = async () => {
        if (selectedFolderIds.length === 0) return
        try {
            message.loading({ content: '正在打包下载...', key: 'batch-folder-download' })
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const response = await fetch(`${apiBase}/api/files/folders/batch-download`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ folder_ids: selectedFolderIds })
            })
            if (handleAuthExpiredResponse(response)) {
                throw new Error('登录已过期，请重新登录')
            }
            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.detail || '下载失败')
            }
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            a.href = url
            a.download = `batch-folders-${timestamp}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            message.success({ content: '下载成功', key: 'batch-folder-download' })
        } catch (error: any) {
            message.error({ content: error.message || '下载失败', key: 'batch-folder-download' })
        }
    }

    const batchDownloadFiles = async () => {
        if (selectedFileIds.length === 0) return
        try {
            message.loading({ content: '正在打包下载...', key: 'batch-download' })
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const response = await fetch(`${apiBase}/api/files/batch-download`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file_ids: selectedFileIds })
            })
            if (handleAuthExpiredResponse(response)) {
                throw new Error('登录已过期，请重新登录')
            }
            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.detail || '下载失败')
            }
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            a.href = url
            a.download = `batch-files-${timestamp}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            message.success({ content: '下载成功', key: 'batch-download' })
        } catch (error: any) {
            message.error({ content: error.message || '下载失败', key: 'batch-download' })
        }
    }

    const openMoveModal = (fileIds: number[]) => {
        if (fileIds.length === 0) {
            message.warning('请选择要移动的文件')
            return
        }
        loadAllFolders()
        setMoveFileModal({ open: true, fileIds })
    }

    const openMoveFolderModal = (folderIds: number[]) => {
        if (folderIds.length === 0) {
            message.warning('请选择要移动的文件夹')
            return
        }
        loadAllFolders()
        setMoveFolderModal({ open: true, folderIds })
    }

    const moveFiles = async (targetFolderId: number | null) => {
        if (moveFileModal.fileIds.length === 0) return
        try {
            await api.post('/files/batch-move', { file_ids: moveFileModal.fileIds, folder_id: targetFolderId })
            message.success('移动成功')
            setMoveFileModal({ open: false, fileIds: [] })
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '移动失败')
        }
    }

    const moveFolders = async (targetFolderId: number | null) => {
        if (moveFolderModal.folderIds.length === 0) return
        try {
            await api.post('/files/folders/batch-move', { folder_ids: moveFolderModal.folderIds, parent_id: targetFolderId })
            message.success('移动成功')
            setMoveFolderModal({ open: false, folderIds: [] })
            setSelectedFolderIds([])
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '移动失败')
        }
    }

    const downloadFolder = async (folder: FolderItem) => {
        try {
            message.loading({ content: '正在打包下载...', key: 'download' })
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const response = await fetch(`${apiBase}/api/files/folders/${folder.id}/download`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
            if (handleAuthExpiredResponse(response)) {
                throw new Error('登录已过期，请重新登录')
            }
            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.detail || '下载失败')
            }
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${folder.name}.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            message.success({ content: '下载成功', key: 'download' })
        } catch (error: any) {
            message.error({ content: error.message || '下载失败', key: 'download' })
        }
    }

    const folderTreeData = useMemo(() => {
        const childrenMap = new Map<number | null, FolderItem[]>()
        allFolders.forEach(folder => {
            const list = childrenMap.get(folder.parent_id) || []
            list.push(folder)
            childrenMap.set(folder.parent_id, list)
        })
        for (const list of childrenMap.values()) {
            list.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        }

        const buildNodes = (parentId: number | null) => {
            const list = childrenMap.get(parentId) || []
            return list.map(folder => ({
                key: folder.id,
                title: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <FolderOutlined style={{ color: '#faad14' }} />
                        <span style={{ flex: 1, minWidth: 0 }}>{folder.name}</span>
                    </span>
                ),
                children: buildNodes(folder.id)
            }))
        }

        return [{
            key: 'root',
            title: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <HomeOutlined />
                    <span>根目录</span>
                </span>
            ),
            children: buildNodes(null)
        }]
    }, [allFolders])

    const handleTreeExpand: TreeProps['onExpand'] = (expandedKeys) => {
        setTreeExpandedKeys(expandedKeys as (string | number)[])
    }

    // 上传配置
    const uploadProps: UploadProps = {
        name: 'files',
        multiple: true,
        customRequest: handleUpload,
        showUploadList: false,
        // 移除 accept 限制，允许所有文件
        // accept: 'image/*', 
        beforeUpload: (file) => {
            // 移除图片类型检查
            // 移除大小限制检查（或者放宽限制）
            const isLt100M = file.size / 1024 / 1024 < 100
            if (!isLt100M) {
                message.error('文件大小不能超过 100MB！')
                return false
            }
            return true
        },
        onChange: (info) => {
            if (info.file.status === 'uploading') {
                setUploading(true)
            }
            if (info.file.status === 'done') {
                setUploading(false)
                message.success(`${info.file.name} 上传成功`)
                loadContents(currentFolderId)
            } else if (info.file.status === 'error') {
                setUploading(false)
                message.error(`${info.file.name} 上传失败`)
            }
        },
    }

    // 创建文件夹
    const createFolder = async () => {
        if (!newFolderName.trim()) {
            message.error('请输入文件夹名称')
            return
        }
        try {
            await api.post(`/files/folders?name=${encodeURIComponent(newFolderName)}${currentFolderId ? `&parent_id=${currentFolderId}` : ''}`)
            message.success('文件夹创建成功')
            setNewFolderModal(false)
            setNewFolderName('')
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '创建失败')
        }
    }

    // 删除文件夹
    const deleteFolder = async (folder: FolderItem) => {
        try {
            await api.delete(`/files/folders/${folder.id}`)
            message.success('删除成功')
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '删除失败')
        }
    }

    // 删除文件
    const handleDelete = async (file: FileItem) => {
        try {
            await apiRequest(`/api/files/${file.id}`, { method: 'DELETE' })
            message.success('删除成功')
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.message || '删除失败')
        }
    }

    // 批量删除
    const batchDelete = async () => {
        if (selectedFileIds.length > 0) {
            try {
                await api.post('/files/batch-delete', { file_ids: selectedFileIds })
                message.success(`已删除 ${selectedFileIds.length} 个文件`)
                setSelectedFileIds([])
            } catch {
                message.error('批量删除文件失败')
            }
        }
        if (selectedFolderIds.length > 0) {
            try {
                await api.post('/files/folders/batch-delete', { folder_ids: selectedFolderIds })
                message.success(`已删除 ${selectedFolderIds.length} 个文件夹`)
                setSelectedFolderIds([])
            } catch {
                message.error('批量删除文件夹失败')
            }
        }
        loadContents(currentFolderId)
    }




    // 格式化文件大小
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    // 文件图标助手
    const getFileIcon = (filename: string, contentType: string) => {
        if (contentType.startsWith('image/')) return <EyeOutlined />

        const ext = filename.split('.').pop()?.toLowerCase() || ''
        if (['doc', 'docx'].includes(ext)) return <FileWordOutlined style={{ color: '#1890ff' }} />
        if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileExcelOutlined style={{ color: '#52c41a' }} />
        if (['ppt', 'pptx'].includes(ext)) return <FilePptOutlined style={{ color: '#fa8c16' }} />
        if (['pdf'].includes(ext)) return <FilePdfOutlined style={{ color: '#f5222d' }} />
        if (['txt', 'md'].includes(ext)) return <FileTextOutlined style={{ color: '#666' }} />
        if (['mp4', 'mov', 'avi'].includes(ext)) return <VideoCameraOutlined style={{ color: '#722ed1' }} />

        return <FileOutlined />
    }

    // 下载文件
    const handleDownload = (file: FileItem) => {
        const link = document.createElement('a')
        link.href = file.url
        link.download = file.filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // 进入文件夹
    const enterFolder = (folderId: number) => {
        setCurrentFolderId(folderId)
    }

    // 返回上级
    const goBack = () => {
        if (!currentFolderId || currentFolderId === poiFolderId) return

        // 尝试通过面包屑返回
        if (breadcrumb.length > 0) {
            // 当前文件夹是面包屑最后一项，所以返回倒数第二项
            if (breadcrumb.length >= 2) {
                setCurrentFolderId(breadcrumb[breadcrumb.length - 2].id)
            } else {
                // 如果面包屑只有一项，说明父级是根（但这里根可能是POI根目录，也可能是更上层）
                // 既然我们在POI模式，根就是 poiFolderId
                setCurrentFolderId(poiFolderId)
            }
        } else {
            // 默认返回POI根
            setCurrentFolderId(poiFolderId)
        }
    }

    if (!poiFolderId) {
        return (
            <Card>
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={`${entityLabel}文件夹未初始化，请先保存${entityLabel}`}
                />
            </Card>
        )
    }

    return (
        <div>
            {/* 顶部操作栏 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <Space>
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={goBack}
                        disabled={!currentFolderId || currentFolderId === poiFolderId}
                    >
                        返回上级
                    </Button>
                    <Breadcrumb>
                        <Breadcrumb.Item>
                            <a onClick={() => setCurrentFolderId(poiFolderId)}>
                                <HomeOutlined /> 根目录
                            </a>
                        </Breadcrumb.Item>
                        {breadcrumb.map((item, index) => (
                            <Breadcrumb.Item key={item.id}>
                                {index === breadcrumb.length - 1 ? (
                                    <span>{item.name}</span>
                                ) : (
                                    <a onClick={() => setCurrentFolderId(item.id)}>{item.name}</a>
                                )}
                            </Breadcrumb.Item>
                        ))}
                    </Breadcrumb>
                </Space>
                {!readonly && (
                    <Space>
                        {/* 批量操作 */}
                        {(selectedFileIds.length > 0 || selectedFolderIds.length > 0) && (
                            <>
                                <Popconfirm title="确定删除选中项吗？" onConfirm={batchDelete}>
                                    <Button danger icon={<DeleteOutlined />}>批量删除</Button>
                                </Popconfirm>
                                <Dropdown
                                    menu={{
                                        items: [
                                            {
                                                key: 'download',
                                                label: '批量下载',
                                                icon: <CloudDownloadOutlined />,
                                                onClick: () => {
                                                    if (selectedFileIds.length > 0) batchDownloadFiles()
                                                    if (selectedFolderIds.length > 0) batchDownloadFolders()
                                                }
                                            },
                                            {
                                                key: 'move',
                                                label: '批量移动',
                                                icon: <ScissorOutlined />,
                                                onClick: () => {
                                                    if (selectedFileIds.length > 0) openMoveModal(selectedFileIds)
                                                    if (selectedFolderIds.length > 0) openMoveFolderModal(selectedFolderIds)
                                                }
                                            }
                                        ]
                                    }}
                                >
                                    <Button icon={<MoreOutlined />}>更多批量操作</Button>
                                </Dropdown>
                            </>
                        )}
                        <Button icon={<FolderAddOutlined />} onClick={() => setNewFolderModal(true)}>
                            新建文件夹
                        </Button>
                        <Upload {...uploadProps}>
                            <Button type="primary" icon={<UploadOutlined />} loading={uploading} disabled={uploading}>
                                上传文件
                            </Button>
                        </Upload>
                    </Space>
                )}
            </div>

            {/* 新建文件夹Modal */}
            <Modal
                title="新建文件夹"
                open={newFolderModal}
                onOk={createFolder}
                onCancel={() => setNewFolderModal(false)}
            >
                <Input
                    placeholder="请输入文件夹名称"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onPressEnter={createFolder}
                />
            </Modal>

            {/* 高级功能 Modals */}
            <Modal
                title={`重命名${renameModal.folder ? '文件夹' : '文件'}`}
                open={renameModal.open}
                onCancel={() => setRenameModal({ open: false })}
                onOk={renameFolder}
            >
                <Input
                    placeholder="请输入新名称"
                    value={renameModal.name}
                    onChange={e => setRenameModal(prev => ({ ...prev, name: e.target.value }))}
                    onPressEnter={renameFolder}
                />
            </Modal>

            <Modal
                title="移动文件"
                open={moveFileModal.open}
                onCancel={() => setMoveFileModal({ open: false, fileIds: [] })}
                footer={null}
            >
                <div style={{ height: 400, overflow: 'auto' }}>
                    <Tree
                        treeData={folderTreeData}
                        expandedKeys={treeExpandedKeys}
                        onExpand={handleTreeExpand}
                        onSelect={(selectedKeys) => {
                            if (selectedKeys.length > 0) {
                                const key = selectedKeys[0]
                                if (key !== 'root') moveFiles(Number(key))
                                else moveFiles(null)
                            }
                        }}
                    />
                </div>
            </Modal>

            <Modal
                title="移动文件夹"
                open={moveFolderModal.open}
                onCancel={() => setMoveFolderModal({ open: false, folderIds: [] })}
                footer={null}
            >
                <div style={{ height: 400, overflow: 'auto' }}>
                    <Tree
                        treeData={folderTreeData}
                        expandedKeys={treeExpandedKeys}
                        onExpand={handleTreeExpand}
                        onSelect={(selectedKeys) => {
                            if (selectedKeys.length > 0) {
                                const key = selectedKeys[0]
                                moveFolders(key === 'root' ? null : Number(key))
                            }
                        }}
                    />
                </div>
            </Modal>

            <Modal
                title={previewModal.file?.filename}
                open={previewModal.open}
                onCancel={() => setPreviewModal({ open: false })}
                footer={null}
                width={800}
                destroyOnClose
            >
                {previewModal.file && (
                    isImage(previewModal.file.content_type) ? (
                        <img src={previewModal.file.url} style={{ width: '100%' }} />
                    ) : isWordDoc(previewModal.file) ? (
                        <iframe
                            src={getWordPreviewUrl(previewModal.file.url)}
                            width="100%"
                            height="600px"
                            frameBorder="0"
                        />
                    ) : (
                        <Empty description="不支持预览" />
                    )
                )}
            </Modal>

            <Spin spinning={loading}>
                {files.length === 0 && folders.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={readonly ? "暂无文件" : "暂无文件，请上传或新建文件夹"}
                    />
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '16px'
                    }}>
                        {/* 渲染文件夹 */}
                        {folders.map(folder => (
                            <Card
                                key={`folder-${folder.id}`}
                                size="small"
                                hoverable
                                actions={!readonly ? [
                                    <Dropdown
                                        key="more"
                                        menu={{
                                            items: [
                                                { label: '重命名', icon: <EditOutlined />, key: 'rename', onClick: () => setRenameModal({ open: true, folder, name: folder.name }) },
                                                { label: '移动', icon: <ScissorOutlined />, key: 'move', onClick: () => openMoveFolderModal([folder.id]) },
                                                { label: '下载ZIP', icon: <FileZipOutlined />, key: 'download', onClick: () => downloadFolder(folder) },
                                                { type: 'divider' },
                                                {
                                                    label: '删除', icon: <DeleteOutlined />, key: 'delete', danger: true, onClick: () => {
                                                        Modal.confirm({ title: '确认删除', content: `确定要删除文件夹 "${folder.name}" 吗？`, onOk: () => deleteFolder(folder) })
                                                    }
                                                }
                                            ]
                                        }}
                                        trigger={['click']}
                                    >
                                        <div onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <MoreOutlined />
                                        </div>
                                    </Dropdown>
                                ] : []}
                                onClick={() => enterFolder(folder.id)}
                            >
                                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                    <FolderOutlined style={{ fontSize: 48, color: '#ffec3d' }} />
                                    <div style={{ marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {folder.name}
                                    </div>
                                    {!readonly && (
                                        <div style={{ position: 'absolute', top: 5, left: 5 }} onClick={e => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedFolderIds.includes(folder.id)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedFolderIds([...selectedFolderIds, folder.id])
                                                    else setSelectedFolderIds(selectedFolderIds.filter(id => id !== folder.id))
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ))}

                        {/* 渲染文件 */}
                        {files.map(file => (
                            <Card
                                key={`file-${file.id}`}
                                size="small"
                                hoverable
                                cover={
                                    <div style={{
                                        height: 100,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: '#fafafa',
                                        borderBottom: '1px solid #f0f0f0',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }} onClick={() => {
                                        if (mode === 'select') {
                                            toggleFileSelection(file)
                                        } else {
                                            openPreview(file)
                                        }
                                    }}>
                                        {file.content_type.startsWith('image/') ? (
                                            <Image
                                                src={file.url}
                                                alt={file.filename}
                                                preview={false}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onClick={(e) => {
                                                    if (mode === 'select') {
                                                        e.stopPropagation()
                                                        toggleFileSelection(file)
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <div style={{ fontSize: 40 }}>
                                                {getFileIcon(file.filename, file.content_type)}
                                            </div>
                                        )}
                                        {(!readonly || mode === 'select') && (
                                            <div style={{ position: 'absolute', top: 5, left: 5 }} onClick={e => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedFileIds.includes(file.id)}
                                                    onChange={e => {
                                                        e.stopPropagation()
                                                        toggleFileSelection(file)
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                }
                                actions={(readonly || mode === 'select') ? [] : [
                                    <DownloadOutlined key="download" onClick={() => handleDownload(file)} />,
                                    <Dropdown
                                        key="more"
                                        menu={{
                                            items: [
                                                { label: '移动', icon: <ScissorOutlined />, key: 'move', onClick: () => openMoveModal([file.id]) },
                                                { type: 'divider' },
                                                {
                                                    label: '删除', icon: <DeleteOutlined />, key: 'delete', danger: true, onClick: () => {
                                                        Modal.confirm({ title: '确认删除', content: `确定要删除文件 "${file.filename}" 吗？`, onOk: () => handleDelete(file) })
                                                    }
                                                }
                                            ]
                                        }}
                                        trigger={['click']}
                                    >
                                        <div onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <MoreOutlined />
                                        </div>
                                    </Dropdown>
                                ]}
                            >
                                <Card.Meta
                                    title={
                                        <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.filename}>
                                            {file.filename}
                                        </div>
                                    }
                                    description={<span style={{ fontSize: 12 }}>{formatSize(file.size)}</span>}
                                />
                            </Card>
                        ))}
                    </div>
                )}
            </Spin>
        </div>
    )
}
