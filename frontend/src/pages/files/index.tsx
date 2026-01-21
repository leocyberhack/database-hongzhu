import { useState, useEffect, useMemo } from 'react'
import { Card, Upload, Button, Space, Image, message, Popconfirm, Input, Tag, Empty, Modal, Breadcrumb, Dropdown, Checkbox, Tree } from 'antd'
import {
    UploadOutlined, DeleteOutlined, CopyOutlined, SearchOutlined,
    FolderOutlined, FolderAddOutlined, FileOutlined, HomeOutlined,
    EditOutlined, DragOutlined, MoreOutlined, FolderOpenOutlined, DownloadOutlined, EyeOutlined,
    LockOutlined, UnlockOutlined, KeyOutlined, ArrowLeftOutlined
} from '@ant-design/icons'
import type { UploadProps, MenuProps, TreeProps } from 'antd'
import { getToken, api, apiRequest } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface FolderItem {
    id: number
    name: string
    parent_id: number | null
    has_password?: boolean
    created_by: string
    created_at: string
}

interface FileItem {
    id: number
    filename: string
    object_name: string
    url: string
    size: number
    content_type: string
    folder_id: number | null
    created_by: string
    created_at: string
}

interface BreadcrumbItem {
    id: number
    name: string
    has_password?: boolean
}

export default function FilesPage() {
    const { user } = useAuth()
    const [folders, setFolders] = useState<FolderItem[]>([])
    const [files, setFiles] = useState<FileItem[]>([])
    const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])
    const [uploading, setUploading] = useState(false)
    const [searchText, setSearchText] = useState('')
    const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([])
    const [selectedFileIds, setSelectedFileIds] = useState<number[]>([])
    const [folderPasswords, setFolderPasswords] = useState<Record<number, string>>({})
    const [newFolderModal, setNewFolderModal] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [renameModal, setRenameModal] = useState<{ open: boolean; folder?: FolderItem }>({ open: false })
    const [moveFileModal, setMoveFileModal] = useState<{ open: boolean; fileIds: number[] }>({ open: false, fileIds: [] })
    const [moveFolderModal, setMoveFolderModal] = useState<{ open: boolean; folderIds: number[] }>({ open: false, folderIds: [] })
    const [previewModal, setPreviewModal] = useState<{ open: boolean; file?: FileItem }>({ open: false })
    const [folderPasswordModal, setFolderPasswordModal] = useState<{
        open: boolean
        folder?: FolderItem
        mode: 'set' | 'reset' | 'verify'
    }>({ open: false, mode: 'verify' })
    const [folderPasswordInput, setFolderPasswordInput] = useState('')
    const [allFolders, setAllFolders] = useState<FolderItem[]>([])
    const [treeExpandedKeys, setTreeExpandedKeys] = useState<(string | number)[]>(['root'])
    const canManageFolderPassword = user?.role !== 'csr'
    const isSuperAdmin = user?.role === 'super_admin'

    // 加载当前目录内容
    const loadContents = async (folderId: number | null) => {
        try {
            const password = folderId ? folderPasswords[folderId] : undefined
            const headers = password ? { 'X-Folder-Password': password } : undefined
            const [foldersRes, filesRes] = await Promise.all([
                apiRequest<FolderItem[]>(`/api/files/folders${folderId ? `?parent_id=${folderId}` : ''}`, { headers }),
                apiRequest<FileItem[]>(`/api/files/list${folderId ? `?folder_id=${folderId}` : ''}`, { headers })
            ])
            setFolders(foldersRes)
            setFiles(filesRes)
            loadAllFolders()
        } catch (error: any) {
            message.error(error.message || '加载失败')
        }
    }

    // 加载面包屑
    const loadBreadcrumb = async (folderId: number | null) => {
        if (!folderId) {
            setBreadcrumb([])
            return
        }
        try {
            const res = await api.get(`/files/folders/${folderId}/path`)
            setBreadcrumb(res.data)
        } catch (error) {
            console.error(error)
        }
    }

    // 加载所有文件夹（用于移动文件/文件夹）
    const loadAllFolders = async () => {
        try {
            const res = await api.get('/files/folders/all')
            setAllFolders(res.data)
        } catch (error) {
            console.error(error)
        }
    }

    useEffect(() => {
        loadContents(currentFolderId)
        loadBreadcrumb(currentFolderId)
    }, [currentFolderId])

    useEffect(() => {
        const folderIdSet = new Set(folders.map(folder => folder.id))
        setSelectedFolderIds(prev => prev.filter(id => folderIdSet.has(id)))
    }, [folders])

    useEffect(() => {
        const fileIdSet = new Set(files.map(file => file.id))
        setSelectedFileIds(prev => prev.filter(id => fileIdSet.has(id)))
    }, [files])

    useEffect(() => {
        setTreeExpandedKeys(prev => {
            const next = new Set(prev)
            next.add('root')
            breadcrumb.forEach(item => next.add(item.id))
            return Array.from(next)
        })
    }, [breadcrumb])

    // 进入文件夹
    const enterFolder = (folder: FolderItem) => {
        if (folder.has_password && !folderPasswords[folder.id]) {
            openFolderPasswordModal(folder, 'verify')
            return
        }
        setCurrentFolderId(folder.id)
        setSearchText('')
    }

    const enterFolderByBreadcrumb = (item: BreadcrumbItem) => {
        if (item.has_password && !folderPasswords[item.id]) {
            openFolderPasswordModal({
                id: item.id,
                name: item.name,
                parent_id: null,
                created_by: '',
                created_at: '',
                has_password: true,
            }, 'verify')
            return
        }
        setCurrentFolderId(item.id)
        setSearchText('')
    }

    // 返回上级
    const goBack = () => {
        if (breadcrumb.length > 1) {
            setCurrentFolderId(breadcrumb[breadcrumb.length - 2].id)
        } else {
            setCurrentFolderId(null)
        }
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

    // 重命名文件夹
    const renameFolder = async () => {
        if (!renameModal.folder || !newFolderName.trim()) return
        try {
            await api.put(`/files/folders/${renameModal.folder.id}?name=${encodeURIComponent(newFolderName)}`)
            message.success('重命名成功')
            setRenameModal({ open: false })
            setNewFolderName('')
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '重命名失败')
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

    const openFolderPasswordModal = (folder: FolderItem, mode: 'set' | 'reset' | 'verify') => {
        setFolderPasswordInput('')
        setFolderPasswordModal({ open: true, folder, mode })
    }

    const handleFolderPasswordConfirm = async () => {
        const folder = folderPasswordModal.folder
        const password = folderPasswordInput.trim()
        if (!folder) return
        if (!password) {
            message.error('请输入密码')
            return
        }

        try {
            if (folderPasswordModal.mode === 'set') {
                await api.post(`/files/folders/${folder.id}/password`, { password })
                message.success('设置密码成功')
                loadContents(currentFolderId)
            } else if (folderPasswordModal.mode === 'reset') {
                await api.post(`/files/folders/${folder.id}/password/reset`, { password })
                message.success('重置密码成功')
                setFolderPasswords(prev => ({ ...prev, [folder.id]: password }))
                loadContents(currentFolderId)
            } else {
                await api.post(`/files/folders/${folder.id}/verify`, { password })
                setFolderPasswords(prev => ({ ...prev, [folder.id]: password }))
                setCurrentFolderId(folder.id)
                setSearchText('')
            }
            setFolderPasswordModal({ open: false, mode: 'verify' })
            setFolderPasswordInput('')
        } catch (error: any) {
            message.error(error.response?.data?.detail || '操作失败')
        }
    }

    const deleteFolderPassword = async (folder: FolderItem) => {
        try {
            await api.delete(`/files/folders/${folder.id}/password`)
            message.success('删除密码成功')
            setFolderPasswords(prev => {
                const next = { ...prev }
                delete next[folder.id]
                return next
            })
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '删除失败')
        }
    }

    const batchDeleteFolders = async () => {
        if (selectedFolderIds.length === 0) return
        try {
            await api.post('/files/folders/batch-delete', { folder_ids: selectedFolderIds })
            message.success(`已删除 ${selectedFolderIds.length} 个文件夹`)
            setSelectedFolderIds([])
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '批量删除失败')
        }
    }

    // 删除文件
    const deleteFile = async (file: FileItem) => {
        try {
            await api.delete(`/files/${file.id}`)
            message.success('删除成功')
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '删除失败')
        }
    }

    const batchDeleteFiles = async () => {
        if (selectedFileIds.length === 0) return
        try {
            await api.post('/files/batch-delete', { file_ids: selectedFileIds })
            message.success(`已删除 ${selectedFileIds.length} 个文件`)
            setSelectedFileIds([])
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '批量删除失败')
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
            if (!response.ok) {
                let errMsg = '下载失败'
                try {
                    const err = await response.json()
                    errMsg = err.detail || errMsg
                } catch {}
                throw new Error(errMsg)
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
            if (!response.ok) {
                let errMsg = '下载失败'
                try {
                    const err = await response.json()
                    errMsg = err.detail || errMsg
                } catch {}
                throw new Error(errMsg)
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

    // 移动文件
    const moveFiles = async (targetFolderId: number | null) => {
        if (moveFileModal.fileIds.length === 0) return
        try {
            await api.post('/files/batch-move', { file_ids: moveFileModal.fileIds, folder_id: targetFolderId })
            message.success(moveFileModal.fileIds.length > 1 ? `移动成功，共 ${moveFileModal.fileIds.length} 个文件` : '移动成功')
            setMoveFileModal({ open: false, fileIds: [] })
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '移动失败')
        }
    }

    // 移动文件夹
    const moveFolders = async (targetFolderId: number | null) => {
        if (moveFolderModal.folderIds.length === 0) return
        try {
            await api.post('/files/folders/batch-move', { folder_ids: moveFolderModal.folderIds, parent_id: targetFolderId })
            message.success(moveFolderModal.folderIds.length > 1 ? `移动成功，共 ${moveFolderModal.folderIds.length} 个文件夹` : '移动成功')
            setMoveFolderModal({ open: false, folderIds: [] })
            setSelectedFolderIds([])
            loadContents(currentFolderId)
        } catch (error: any) {
            message.error(error.response?.data?.detail || '移动失败')
        }
    }

    // 上传文件
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
                headers: { 'Authorization': `Bearer ${getToken()}` },
                body: formData
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.detail || '上传失败')
            if (result.success?.length > 0) {
                onSuccess?.(result)
                message.success('上传成功')
                loadContents(currentFolderId)
            } else if (result.errors?.length > 0) {
                throw new Error(result.errors[0].error)
            }
        } catch (error: any) {
            message.error(error.message || '上传失败')
            onError?.(error)
        } finally {
            setUploading(false)
        }
    }

    const copyUrl = (url: string) => {
        navigator.clipboard.writeText(url)
        message.success('链接已复制')
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

    const openPreview = (file: FileItem) => {
        if (!canPreview(file)) {
            message.warning('该文件暂不支持预览')
            return
        }
        setPreviewModal({ open: true, file })
    }

    const getWordPreviewUrl = (url: string) =>
        `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`

    const currentPathLabel = useMemo(() => {
        if (breadcrumb.length === 0) return '根目录'
        return ['根目录', ...breadcrumb.map(item => item.name)].join(' / ')
    }, [breadcrumb])

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
                        {folder.has_password && <LockOutlined style={{ color: '#d48806' }} />}
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

    const folderPathMap = useMemo(() => {
        const map = new Map<number, FolderItem>()
        const pathMap = new Map<number, string>()
        allFolders.forEach(folder => map.set(folder.id, folder))

        const buildPath = (folderId: number): string => {
            if (pathMap.has(folderId)) return pathMap.get(folderId) as string
            const folder = map.get(folderId)
            if (!folder) return ''
            if (!folder.parent_id) {
                pathMap.set(folderId, folder.name)
                return folder.name
            }
            const parentPath = buildPath(folder.parent_id)
            const fullPath = parentPath ? `${parentPath}/${folder.name}` : folder.name
            pathMap.set(folderId, fullPath)
            return fullPath
        }

        allFolders.forEach(folder => buildPath(folder.id))
        return pathMap
    }, [allFolders])

    const handleTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
        if (selectedKeys.length === 0) return
        const selectedKey = selectedKeys[0]
        if (selectedKey === 'root') {
            setCurrentFolderId(null)
            setSearchText('')
            return
        }
        const folderId = typeof selectedKey === 'string' ? Number(selectedKey) : selectedKey
        const targetFolder = allFolders.find(folder => folder.id === folderId)
        if (targetFolder) {
            enterFolder(targetFolder)
        }
    }

    const handleTreeExpand: TreeProps['onExpand'] = (expandedKeys) => {
        setTreeExpandedKeys(expandedKeys as (string | number)[])
    }

    const getDescendantFolderIds = (rootIds: number[]) => {
        const childrenMap = new Map<number, number[]>()
        allFolders.forEach(folder => {
            if (!folder.parent_id) return
            const list = childrenMap.get(folder.parent_id) || []
            list.push(folder.id)
            childrenMap.set(folder.parent_id, list)
        })
        const descendants = new Set<number>()
        const stack = [...rootIds]
        while (stack.length > 0) {
            const currentId = stack.pop()
            if (currentId === undefined || descendants.has(currentId)) continue
            descendants.add(currentId)
            const children = childrenMap.get(currentId) || []
            children.forEach(id => stack.push(id))
        }
        return descendants
    }

    // 下载文件
    const downloadFile = (file: FileItem) => {
        const a = document.createElement('a')
        a.href = file.url
        a.download = file.filename
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    // 下载文件夹为 ZIP
    const downloadFolder = async (folder: FolderItem) => {
        try {
            message.loading({ content: '正在打包下载...', key: 'download' })
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const response = await fetch(`${apiBase}/api/files/folders/${folder.id}/download`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
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

    // 文件夹操作菜单
    const getFolderMenu = (folder: FolderItem): MenuProps => {
        const items: MenuProps['items'] = [
            { key: 'download', icon: <DownloadOutlined />, label: '下载为 ZIP', onClick: () => downloadFolder(folder) },
            { key: 'rename', icon: <EditOutlined />, label: '重命名', onClick: () => { setNewFolderName(folder.name); setRenameModal({ open: true, folder }) } },
        ]

        if (canManageFolderPassword && !folder.has_password) {
            items.push({
                key: 'set-password',
                icon: <LockOutlined />,
                label: '设置密码',
                onClick: () => openFolderPasswordModal(folder, 'set'),
            })
        }

        if (isSuperAdmin && folder.has_password) {
            items.push(
                { key: 'reset-password', icon: <KeyOutlined />, label: '重置密码', onClick: () => openFolderPasswordModal(folder, 'reset') },
                { key: 'remove-password', icon: <UnlockOutlined />, label: '删除密码', onClick: () => deleteFolderPassword(folder) },
            )
        }

        items.push(
            { type: 'divider' },
            { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => deleteFolder(folder) },
        )

        return { items }
    }

    // 文件操作菜单
    const getFileMenu = (file: FileItem): MenuProps => {
        const items: MenuProps['items'] = []
        if (canPreview(file)) {
            items.push({ key: 'preview', icon: <EyeOutlined />, label: '预览', onClick: () => openPreview(file) })
        }
        items.push(
            { key: 'download', icon: <DownloadOutlined />, label: '下载', onClick: () => downloadFile(file) },
            { key: 'copy', icon: <CopyOutlined />, label: '复制链接', onClick: () => copyUrl(file.url) },
            { key: 'move', icon: <DragOutlined />, label: '移动到...', onClick: () => openMoveModal([file.id]) },
            { type: 'divider' },
            { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true, onClick: () => deleteFile(file) },
        )
        return { items }
    }

    // 过滤
    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchText.toLowerCase()))
    const filteredFiles = files.filter(f => f.filename.toLowerCase().includes(searchText.toLowerCase()))
    const visibleFolderIds = filteredFolders.map(folder => folder.id)
    const visibleFileIds = filteredFiles.map(file => file.id)
    const selectedFolderIdSet = new Set(selectedFolderIds)
    const selectedFileIdSet = new Set(selectedFileIds)
    const allFoldersSelected = visibleFolderIds.length > 0 && visibleFolderIds.every(id => selectedFolderIdSet.has(id))
    const allFilesSelected = visibleFileIds.length > 0 && visibleFileIds.every(id => selectedFileIdSet.has(id))
    const someFoldersSelected = selectedFolderIds.length > 0 && !allFoldersSelected
    const someFilesSelected = selectedFileIds.length > 0 && !allFilesSelected

    const toggleFolderSelection = (folderId: number, checked: boolean) => {
        setSelectedFolderIds(prev => {
            if (checked) return Array.from(new Set([...prev, folderId]))
            return prev.filter(id => id !== folderId)
        })
    }

    const toggleFileSelection = (fileId: number, checked: boolean) => {
        setSelectedFileIds(prev => {
            if (checked) return Array.from(new Set([...prev, fileId]))
            return prev.filter(id => id !== fileId)
        })
    }

    const toggleSelectAllFolders = (checked: boolean) => {
        if (checked) {
            const next = new Set(selectedFolderIds)
            visibleFolderIds.forEach(id => next.add(id))
            setSelectedFolderIds(Array.from(next))
        } else {
            const visibleSet = new Set(visibleFolderIds)
            setSelectedFolderIds(prev => prev.filter(id => !visibleSet.has(id)))
        }
    }

    const toggleSelectAllFiles = (checked: boolean) => {
        if (checked) {
            const next = new Set(selectedFileIds)
            visibleFileIds.forEach(id => next.add(id))
            setSelectedFileIds(Array.from(next))
        } else {
            const visibleSet = new Set(visibleFileIds)
            setSelectedFileIds(prev => prev.filter(id => !visibleSet.has(id)))
        }
    }

    const invalidMoveFolderTargetIds = useMemo(() => {
        if (moveFolderModal.folderIds.length === 0) return new Set<number>()
        return getDescendantFolderIds(moveFolderModal.folderIds)
    }, [moveFolderModal.folderIds, allFolders])

    const folderMoveTargets = allFolders.filter(folder => !invalidMoveFolderTargetIds.has(folder.id))
    const folderPasswordTitle = folderPasswordModal.mode === 'verify'
        ? '输入文件夹密码'
        : folderPasswordModal.mode === 'reset'
            ? '重置文件夹密码'
            : '设置文件夹密码'

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">文件管理</h1>
                    <p className="page-subtitle">管理图片、文档等文件资源</p>
                </div>
                <Space>
                    <Button icon={<FolderAddOutlined />} onClick={() => setNewFolderModal(true)}>
                        新建文件夹
                    </Button>
                    <Upload customRequest={handleUpload} showUploadList={false} accept="image/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.mp4" multiple>
                        <Button type="primary" icon={<UploadOutlined />} loading={uploading}>上传文件</Button>
                    </Upload>
                </Space>
            </div>

            <Card>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: '0 0 240px', minWidth: 220 }}>
                        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>目录树</div>
                        <div
                            style={{ fontSize: 12, color: '#999', marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            title={currentPathLabel}
                        >
                            当前层级：{currentPathLabel}
                        </div>
                        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 8, maxHeight: 520, overflow: 'auto', background: '#fafafa' }}>
                            <Tree
                                treeData={folderTreeData}
                                selectedKeys={[currentFolderId ?? 'root']}
                                expandedKeys={treeExpandedKeys}
                                onExpand={handleTreeExpand}
                                onSelect={handleTreeSelect}
                                blockNode
                                showLine={{ showLeafIcon: false }}
                            />
                        </div>
                    </div>
                    <div style={{ flex: '1 1 640px', minWidth: 0 }}>
                {/* 面包屑导航 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Button icon={<ArrowLeftOutlined />} onClick={goBack} disabled={!currentFolderId}>
                        返回上一层
                    </Button>
                    <Breadcrumb>
                    <Breadcrumb.Item>
                        <a onClick={() => setCurrentFolderId(null)}><HomeOutlined /> 根目录</a>
                    </Breadcrumb.Item>
                    {breadcrumb.map((item, index) => (
                        <Breadcrumb.Item key={item.id}>
                            {index === breadcrumb.length - 1 ? (
                                <span><FolderOpenOutlined /> {item.name}</span>
                            ) : (
                                <a onClick={() => enterFolderByBreadcrumb(item)}><FolderOutlined /> {item.name}</a>
                            )}
                        </Breadcrumb.Item>
                    ))}
                    </Breadcrumb>
                </div>

                {/* 搜索 */}
                <div style={{ marginBottom: 16 }}>
                    <Input
                        placeholder="搜索文件或文件夹..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 300 }}
                        allowClear
                    />
                </div>

                {/* 批量操作 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#666', fontSize: 12 }}>文件夹</span>
                        <Checkbox
                            indeterminate={someFoldersSelected}
                            checked={allFoldersSelected}
                            onChange={e => toggleSelectAllFolders(e.target.checked)}
                            disabled={filteredFolders.length === 0}
                        >
                            全选
                        </Checkbox>
                        {selectedFolderIds.length > 0 && <Tag color="blue">已选 {selectedFolderIds.length} 项</Tag>}
                        <Button icon={<DragOutlined />} disabled={selectedFolderIds.length === 0} onClick={() => openMoveFolderModal(selectedFolderIds)}>
                            批量移动
                        </Button>
                        <Button icon={<DownloadOutlined />} disabled={selectedFolderIds.length === 0} onClick={batchDownloadFolders}>
                            批量下载
                        </Button>
                        <Popconfirm
                            title={`确定删除选中的 ${selectedFolderIds.length} 个文件夹吗？`}
                            onConfirm={batchDeleteFolders}
                            okText="删除"
                            cancelText="取消"
                            disabled={selectedFolderIds.length === 0}
                        >
                            <Button danger icon={<DeleteOutlined />} disabled={selectedFolderIds.length === 0}>
                                批量删除
                            </Button>
                        </Popconfirm>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#666', fontSize: 12 }}>文件</span>
                        <Checkbox
                            indeterminate={someFilesSelected}
                            checked={allFilesSelected}
                            onChange={e => toggleSelectAllFiles(e.target.checked)}
                            disabled={filteredFiles.length === 0}
                        >
                            全选
                        </Checkbox>
                        {selectedFileIds.length > 0 && <Tag color="blue">已选 {selectedFileIds.length} 项</Tag>}
                        <Button icon={<DragOutlined />} disabled={selectedFileIds.length === 0} onClick={() => openMoveModal(selectedFileIds)}>
                            批量移动
                        </Button>
                        <Button icon={<DownloadOutlined />} disabled={selectedFileIds.length === 0} onClick={batchDownloadFiles}>
                            批量下载
                        </Button>
                        <Popconfirm
                            title={`确定删除选中的 ${selectedFileIds.length} 个文件吗？`}
                            onConfirm={batchDeleteFiles}
                            okText="删除"
                            cancelText="取消"
                            disabled={selectedFileIds.length === 0}
                        >
                            <Button danger icon={<DeleteOutlined />} disabled={selectedFileIds.length === 0}>
                                批量删除
                            </Button>
                        </Popconfirm>
                    </div>
                </div>

                {/* 文件夹列表 */}
                {filteredFolders.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ color: '#666', marginBottom: 8, fontSize: 12 }}>文件夹</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            {filteredFolders.map(folder => (
                                <div
                                    key={folder.id}
                                    style={{
                                        width: 140, padding: 16, borderRadius: 8, border: '1px solid #eee',
                                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                                        background: '#fafafa', position: 'relative'
                                    }}
                                    onDoubleClick={() => enterFolder(folder)}
                                >
                                    <Checkbox
                                        checked={selectedFolderIds.includes(folder.id)}
                                        onChange={e => toggleFolderSelection(folder.id, e.target.checked)}
                                        onClick={e => e.stopPropagation()}
                                        style={{ position: 'absolute', top: 8, left: 8 }}
                                    />
                                    <FolderOutlined style={{ fontSize: 40, color: '#faad14' }} />
                                    <div style={{ marginTop: 8, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {folder.name}
                                        {folder.has_password && <LockOutlined style={{ marginLeft: 6, color: '#d48806' }} />}
                                    </div>
                                    <Dropdown menu={getFolderMenu(folder)} trigger={['click']}>
                                        <Button type="text" size="small" icon={<MoreOutlined />} style={{ marginTop: 4 }} onClick={e => e.stopPropagation()} />
                                    </Dropdown>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 文件列表 */}
                {filteredFiles.length > 0 ? (
                    <div>
                        <div style={{ color: '#666', marginBottom: 8, fontSize: 12 }}>文件</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            {filteredFiles.map(file => (
                                <div
                                    key={file.id}
                                    style={{
                                        width: 140, padding: 12, borderRadius: 8, border: '1px solid #eee',
                                        textAlign: 'center', background: '#fff', position: 'relative'
                                    }}
                                >
                                    <Checkbox
                                        checked={selectedFileIds.includes(file.id)}
                                        onChange={e => toggleFileSelection(file.id, e.target.checked)}
                                        onClick={e => e.stopPropagation()}
                                        style={{ position: 'absolute', top: 8, left: 8 }}
                                    />
                                    {isImage(file.content_type) ? (
                                        <Image
                                            src={file.url}
                                            width={80}
                                            height={80}
                                            preview={false}
                                            style={{ objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                                            onClick={() => openPreview(file)}
                                        />
                                    ) : (
                                        <FileOutlined style={{ fontSize: 40, color: '#1890ff' }} />
                                    )}
                                    <div style={{ marginTop: 8, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.filename}>
                                        {file.filename}
                                    </div>
                                    <Tag style={{ marginTop: 4 }}>{formatSize(file.size)}</Tag>
                                    <Dropdown menu={getFileMenu(file)} trigger={['click']}>
                                        <Button type="text" size="small" icon={<MoreOutlined />} style={{ marginTop: 4 }} />
                                    </Dropdown>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : filteredFolders.length === 0 && (
                    <Empty description="此文件夹为空">
                        <Space>
                            <Button icon={<FolderAddOutlined />} onClick={() => setNewFolderModal(true)}>新建文件夹</Button>
                            <Upload customRequest={handleUpload} showUploadList={false} accept="image/*,.pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.mp4" multiple>
                                <Button type="primary" icon={<UploadOutlined />}>上传文件</Button>
                            </Upload>
                        </Space>
                    </Empty>
                )}
                    </div>
                </div>
            </Card>

            {/* 新建文件夹弹窗 */}
            <Modal
                title="新建文件夹"
                open={newFolderModal}
                onOk={createFolder}
                onCancel={() => { setNewFolderModal(false); setNewFolderName('') }}
            >
                <Input
                    placeholder="文件夹名称"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onPressEnter={createFolder}
                />
            </Modal>

            {/* 重命名弹窗 */}
            <Modal
                title="重命名文件夹"
                open={renameModal.open}
                onOk={renameFolder}
                onCancel={() => { setRenameModal({ open: false }); setNewFolderName('') }}
            >
                <Input
                    placeholder="新名称"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onPressEnter={renameFolder}
                />
            </Modal>

            {/* 文件夹密码弹窗 */}
            <Modal
                title={folderPasswordTitle}
                open={folderPasswordModal.open}
                onOk={handleFolderPasswordConfirm}
                onCancel={() => { setFolderPasswordModal({ open: false, mode: 'verify' }); setFolderPasswordInput('') }}
                okText={folderPasswordModal.mode === 'verify' ? '进入' : '确认'}
                cancelText="取消"
            >
                <Input.Password
                    placeholder="请输入密码"
                    value={folderPasswordInput}
                    onChange={e => setFolderPasswordInput(e.target.value)}
                    onPressEnter={handleFolderPasswordConfirm}
                />
            </Modal>

            {/* 移动文件弹窗 */}
            <Modal
                title={moveFileModal.fileIds.length > 1 ? `移动 ${moveFileModal.fileIds.length} 个文件到...` : '移动文件到...'}
                open={moveFileModal.open}
                onCancel={() => setMoveFileModal({ open: false, fileIds: [] })}
                footer={null}
            >
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <div
                        style={{ padding: 12, cursor: 'pointer', borderRadius: 4, marginBottom: 4, background: '#f5f5f5' }}
                        onClick={() => moveFiles(null)}
                    >
                        <HomeOutlined /> 根目录
                    </div>
                    {allFolders.map(folder => (
                        <div
                            key={folder.id}
                            style={{ padding: 12, cursor: 'pointer', borderRadius: 4, marginBottom: 4, background: '#fafafa' }}
                            onClick={() => moveFiles(folder.id)}
                        >
                            <FolderOutlined style={{ color: '#faad14' }} /> {folderPathMap.get(folder.id) || folder.name}
                        </div>
                    ))}
                </div>
            </Modal>

            {/* 移动文件夹弹窗 */}
            <Modal
                title={moveFolderModal.folderIds.length > 1 ? `移动 ${moveFolderModal.folderIds.length} 个文件夹到...` : '移动文件夹到...'}
                open={moveFolderModal.open}
                onCancel={() => setMoveFolderModal({ open: false, folderIds: [] })}
                footer={null}
            >
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    <div
                        style={{ padding: 12, cursor: 'pointer', borderRadius: 4, marginBottom: 4, background: '#f5f5f5' }}
                        onClick={() => moveFolders(null)}
                    >
                        <HomeOutlined /> 根目录
                    </div>
                    {folderMoveTargets.map(folder => (
                        <div
                            key={folder.id}
                            style={{ padding: 12, cursor: 'pointer', borderRadius: 4, marginBottom: 4, background: '#fafafa' }}
                            onClick={() => moveFolders(folder.id)}
                        >
                            <FolderOutlined style={{ color: '#faad14' }} /> {folderPathMap.get(folder.id) || folder.name}
                        </div>
                    ))}
                </div>
            </Modal>

            {/* 预览弹窗 */}
            <Modal
                title={previewModal.file?.filename || '文件预览'}
                open={previewModal.open}
                onCancel={() => setPreviewModal({ open: false })}
                footer={null}
                width={900}
                destroyOnClose
            >
                {previewModal.file ? (
                    isImage(previewModal.file.content_type) ? (
                        <Image src={previewModal.file.url} preview={false} style={{ maxWidth: '100%' }} />
                    ) : isWordDoc(previewModal.file) ? (
                        <iframe
                            src={getWordPreviewUrl(previewModal.file.url)}
                            style={{ width: '100%', height: '70vh', border: 'none' }}
                            title="word-preview"
                        />
                    ) : (
                        <div>该文件暂不支持预览</div>
                    )
                ) : null}
            </Modal>
        </div>
    )
}
