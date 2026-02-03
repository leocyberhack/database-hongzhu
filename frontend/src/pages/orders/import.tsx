import { useState } from 'react'
import type { UploadProps } from 'antd'
import { Upload, Card, message, Alert, Button, Space } from 'antd'
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons'
import { getToken } from '@/lib/api'

const { Dragger } = Upload

interface ImportResult {
    created: number
    skipped: number
    errors: Array<{ row?: number; order_no?: string; error: string }>
}

export default function OrderImportPage() {
    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState<ImportResult | null>(null)
    const [downloading, setDownloading] = useState(false)

    const handleUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options
        setUploading(true)
        const formData = new FormData()
        formData.append('file', file as File)

        try {
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const url = `${apiBase}/api/orders/import`
            const response = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` },
                body: formData,
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.detail || '导入失败')

            setResult(data)
            onSuccess?.(data)
            if (data.errors?.length) {
                message.warning(`导入完成：成功 ${data.created} 条，跳过 ${data.skipped} 条，失败 ${data.errors.length} 条`)
            } else {
                message.success(`导入完成：成功 ${data.created} 条，跳过 ${data.skipped} 条`)
            }
        } catch (error: any) {
            message.error(error.message || '导入失败')
            onError?.(error)
        } finally {
            setUploading(false)
        }
    }

    const downloadTemplate = async () => {
        try {
            setDownloading(true)
            const apiBase = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').trim().replace(/\/$/, '')
            const response = await fetch(`${apiBase}/api/orders/import-template`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${getToken()}` },
            })
            if (!response.ok) {
                let errMsg = '下载失败'
                try {
                    const err = await response.json()
                    errMsg = err.detail || errMsg
                } catch {
                    // ignore
                }
                throw new Error(errMsg)
            }
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'order-import-template.xlsx'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            message.success('模板下载成功')
        } catch (error: any) {
            message.error(error.message || '模板下载失败')
        } finally {
            setDownloading(false)
        }
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">批量导入订单</h1>
                <p className="page-subtitle">通过 CSV 或 Excel 文件批量导入订单</p>
            </div>

            <div className="glass-card" style={{ padding: '24px', maxWidth: '900px' }}>
                <Space style={{ marginBottom: 16 }}>
                    <Button icon={<DownloadOutlined />} onClick={downloadTemplate} loading={downloading}>
                        下载导入模板
                    </Button>
                </Space>
                <Dragger
                    name="file"
                    multiple={false}
                    accept=".csv,.xlsx"
                    customRequest={handleUpload}
                    showUploadList={false}
                    disabled={uploading}
                >
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                    <p className="ant-upload-hint">支持 CSV / Excel (xlsx) 格式</p>
                </Dragger>

                {result && (
                    <Alert
                        style={{ marginTop: 16 }}
                        type={result.errors?.length ? 'warning' : 'success'}
                        message={`导入完成：成功 ${result.created} 条，跳过 ${result.skipped} 条，失败 ${result.errors?.length || 0} 条`}
                    />
                )}

                {result?.errors?.length ? (
                    <Card size="small" style={{ marginTop: 16 }} title="失败明细（最多展示 20 条）">
                        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
                            {result.errors.slice(0, 20).map((err, idx) => (
                                <div key={`${err.row || 'row'}-${idx}`}>
                                    第 {err.row ?? '-'} 行 {err.order_no ? `(${err.order_no})` : ''}: {err.error}
                                </div>
                            ))}
                        </div>
                    </Card>
                ) : null}

                <Card style={{ marginTop: '24px' }} title="导入说明">
                    <p>• 必填字段：订单号、渠道（名称或ID）、SPU（名称/编码/ID）、SKU（名称或ID）、数量、销售金额、出行日期、支付时间。</p>
                    <p>• 状态字段只需要填写“是”的项；若为“是”，对应时间必填，数量/金额可选。</p>
                    <p>• SKU 会自动关联产品，无需提供产品列；渠道必须绑定该 SKU。</p>
                    <p>• 订单号 + 渠道 为唯一标识，重复订单会跳过。</p>
                    <p>• 日期格式：出行日期为 YYYY-MM-DD；时间字段为 YYYY-MM-DD HH:mm。</p>
                    <pre style={{ background: '#fafafa', padding: 12, borderRadius: 6 }}>
订单号,渠道,SPU,SKU,数量,销售金额,出行日期,支付时间,是否核销,核销时间
                    </pre>
                </Card>
            </div>
        </div>
    )
}
