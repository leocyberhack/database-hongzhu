import { useState } from 'react'
import { Modal, Form, Select, Upload, Button, message, Alert, Space } from 'antd'
import { UploadOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import { apiRequest, getToken } from '@/lib/api'

const RESOURCE_TYPES = ['酒店', '门票', '餐饮', '交通', '组合', '其他']

interface ImportModalProps {
    visible: boolean
    onCancel: () => void
    onSuccess: () => void
}

export default function ImportModal({ visible, onCancel, onSuccess }: ImportModalProps) {
    const [form] = Form.useForm()
    const [uploading, setUploading] = useState(false)
    const [fileList, setFileList] = useState<any[]>([])

    const handleDownloadTemplate = async () => {
        const type = form.getFieldValue('resource_type')
        if (!type) {
            message.warning('请先选择资源类型')
            return
        }

        try {
            // 直接使用 window.open 下载，或者通过 blob 下载
            // 这里我们需要添加 Authorization header，所以不能直接 window.open
            // 使用 fetch 下载 blob
            // 这里我们需要添加 Authorization header，所以不能直接 window.open
            // 使用 fetch 下载 blob
            const token = getToken()
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')

            let downloadApiUrl = `${apiBase}/api/resources/template?resource_type=${type}`
            if (type === '组合') {
                const included = form.getFieldValue('included_types')
                if (!included || included.length < 2) {
                    message.warning('组合资源至少需要包含两种类型的资源')
                    return
                }
                downloadApiUrl += `&sub_types=${encodeURIComponent(included.join(','))}`
            }

            const response = await fetch(downloadApiUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            if (!response.ok) {
                const errJson = await response.json()
                throw new Error(errJson.detail || '下载失败')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url

            // 尝试从 Content-Disposition 获取后端生成的文件名
            let filename = `${type}导入模板.xlsx`
            const disposition = response.headers.get('Content-Disposition')
            if (disposition) {
                const filenameRegex = /filename\*=utf-8''(.+)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = decodeURIComponent(matches[1]);
                }
            }

            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err: any) {
            message.error(err.message)
        }
    }

    const handleUpload = async () => {
        try {
            const values = await form.validateFields()
            if (fileList.length === 0) {
                message.warning('请选择要上传的文件')
                return
            }

            const formData = new FormData()
            formData.append('file', fileList[0].originFileObj)
            formData.append('resource_type', values.resource_type)
            if (values.resource_type === '组合' && values.included_types) {
                formData.append('sub_types', values.included_types.join(','))
            }

            setUploading(true)

            // 使用 fetch 上传，因为 apiRequest 默认是处理 JSON 的，
            // 虽然可以改造 apiRequest 支持 formData，但这里直接写可能更快
            // 虽然可以改造 apiRequest 支持 formData，但这里直接写可能更快
            const token = getToken()
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const response = await fetch(`${apiBase}/api/resources/import`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // 注意：fetch 会自动设置 Content-Type 为 multipart/form-data 并带上 boundary
                },
                body: formData
            })

            const resJson = await response.json()

            if (!response.ok) {
                throw new Error(resJson.detail || '导入失败')
            }

            message.success(resJson.message || '导入成功')
            onSuccess()
            handleCancel()

        } catch (err: any) {
            // 显示详细错误信息
            Modal.error({
                title: '导入失败',
                content: (
                    <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                        <p>{err.message}</p>
                    </div>
                ),
                width: 500
            })
        } finally {
            setUploading(false)
        }
    }

    const handleCancel = () => {
        form.resetFields()
        setFileList([])
        onCancel()
    }

    const uploadProps = {
        onRemove: (file: any) => {
            setFileList((prev) => {
                const index = prev.indexOf(file)
                const newFileList = prev.slice()
                newFileList.splice(index, 1)
                return newFileList
            })
        },
        beforeUpload: (file: any) => {
            setFileList([file]) // 只允许单文件
            return false // 手动上传
        },
        fileList,
        accept: ".xlsx, .xls"
    }

    return (
        <Modal
            title="批量导入资源"
            open={visible}
            onCancel={handleCancel}
            onOk={handleUpload}
            confirmLoading={uploading}
            okText="开始导入"
            cancelText="取消"
            width={600}
        >
            <Form form={form} layout="vertical">
                <Alert
                    message="导入说明"
                    description={
                        <ul style={{ paddingLeft: 20, margin: 0 }}>
                            <li>请先选择资源类型，然后下载对应模板。</li>
                            <li>严格按照模板格式填写，<b>不要修改列头名称</b>。</li>
                            <li>同一个资源名称会覆盖更新原有数据。</li>
                            <li>若关联POI或供应商不存在，系统将自动创建。</li>
                            <li>遇到任何错误将回滚所有操作。</li>
                        </ul>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 24 }}
                />

                <Form.Item
                    name="resource_type"
                    label="资源类型"
                    rules={[{ required: true, message: '请选择资源类型' }]}
                >
                    <Select placeholder="请选择导入的资源类型" onChange={() => setFileList([])}>
                        {RESOURCE_TYPES.map(t => (
                            <Select.Option key={t} value={t}>{t}</Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.resource_type !== curr.resource_type}>
                    {({ getFieldValue }) => {
                        const type = getFieldValue('resource_type')
                        return (
                            <>
                                {type === '组合' && (
                                    <Form.Item
                                        name="included_types"
                                        label="包含类型"
                                        rules={[{ required: true, message: '请选择包含的类型' }]}
                                    >
                                        <Select
                                            mode="multiple"
                                            placeholder="请选择组合包含的资源类型"
                                            options={['门票', '酒店', '餐饮', '交通'].map(t => ({ label: t, value: t }))}
                                        />
                                    </Form.Item>
                                )}
                                {type ? (
                                    <Form.Item>
                                        <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                                            下载 {type} 导入模板
                                        </Button>
                                    </Form.Item>
                                ) : null}
                            </>
                        )
                    }}
                </Form.Item>

                <Form.Item label="上传文件" required>
                    <Upload.Dragger {...uploadProps}>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                        <p className="ant-upload-hint">
                            仅支持 .xlsx 格式文件
                        </p>
                    </Upload.Dragger>
                </Form.Item>
            </Form>
        </Modal>
    )
}
