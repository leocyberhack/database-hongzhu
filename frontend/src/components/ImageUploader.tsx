import { useState } from 'react'
import { Upload, Modal, message, Spin } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { getToken } from '@/lib/api'

interface ImageUploaderProps {
    value?: string[]  // 已上传的图片 URL 列表
    onChange?: (urls: string[]) => void
    maxCount?: number
    accept?: string
}

export default function ImageUploader({
    value = [],
    onChange,
    maxCount = 5,
    accept = "image/*"
}: ImageUploaderProps) {
    const [previewOpen, setPreviewOpen] = useState(false)
    const [previewImage, setPreviewImage] = useState('')
    const [uploading, setUploading] = useState(false)

    // 将 URL 列表转换为 UploadFile 格式
    const fileList: UploadFile[] = value.map((url, index) => ({
        uid: `-${index}`,
        name: url.split('/').pop() || 'image',
        status: 'done',
        url: url,
    }))

    const handlePreview = (file: UploadFile) => {
        setPreviewImage(file.url || '')
        setPreviewOpen(true)
    }

    const handleRemove = (file: UploadFile) => {
        const newUrls = value.filter(url => url !== file.url)
        onChange?.(newUrls)
        return true
    }

    const customUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options

        setUploading(true)
        const formData = new FormData()
        formData.append('files', file as File)

        try {
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const response = await fetch(`${apiBase}/api/files/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`
                },
                body: formData
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.detail || '上传失败')
            }

            if (result.success && result.success.length > 0) {
                const newUrl = result.success[0].url
                const newUrls = [...value, newUrl]
                onChange?.(newUrls)
                onSuccess?.(result)
                message.success('上传成功')
            } else if (result.errors && result.errors.length > 0) {
                throw new Error(result.errors[0].error)
            }
        } catch (error: any) {
            message.error(error.message || '上传失败')
            onError?.(error)
        } finally {
            setUploading(false)
        }
    }

    const uploadButton = (
        <div>
            {uploading ? <Spin size="small" /> : <PlusOutlined />}
            <div style={{ marginTop: 8 }}>上传图片</div>
        </div>
    )

    return (
        <>
            <Upload
                listType="picture-card"
                fileList={fileList}
                onPreview={handlePreview}
                onRemove={handleRemove}
                customRequest={customUpload}
                accept={accept}
                maxCount={maxCount}
            >
                {fileList.length >= maxCount ? null : uploadButton}
            </Upload>

            <Modal
                open={previewOpen}
                title="图片预览"
                footer={null}
                onCancel={() => setPreviewOpen(false)}
            >
                <img alt="preview" style={{ width: '100%' }} src={previewImage} />
            </Modal>
        </>
    )
}
