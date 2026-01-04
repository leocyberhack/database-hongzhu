import { Upload, Card, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'

const { Dragger } = Upload

export default function OrderImportPage() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">批量导入订单</h1>
                <p className="page-subtitle">通过CSV或Excel文件批量导入订单</p>
            </div>

            <div className="glass-card" style={{ padding: '24px', maxWidth: '800px' }}>
                <Dragger
                    name="file"
                    multiple={false}
                    onChange={(info) => {
                        const { status } = info.file
                        if (status === 'done') {
                            message.success(`${info.file.name} 文件上传成功`)
                        } else if (status === 'error') {
                            message.error(`${info.file.name} 文件上传失败`)
                        }
                    }}
                >
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                    <p className="ant-upload-hint">支持 CSV、Excel 格式文件</p>
                </Dragger>

                <Card style={{ marginTop: '24px' }} title="导入说明">
                    <p>• 文件必须包含以下字段：订单号、渠道、SKU、数量、售价、出行日期</p>
                    <p>• 订单号+渠道作为唯一标识，重复订单将被忽略</p>
                    <p>• 导入前请确保关联的SKU和渠道已存在系统中</p>
                </Card>
            </div>
        </div>
    )
}
