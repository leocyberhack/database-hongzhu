import { useCallback } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import { Modal, Typography, Upload, message } from 'antd'
import type { UploadProps } from 'antd'
import { parseCsv } from '../utils/csv'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImported: (rows: Record<string, string>[]) => void
  templateNote?: string
}

export default function ImportModal({ open, onClose, onImported, templateNote }: ImportModalProps) {
  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result?.toString() ?? ''
        if (file.name.endsWith('.json')) {
          try {
            const data = JSON.parse(text)
            onImported(Array.isArray(data) ? data : [])
          } catch (err) {
            console.error(err)
            message.error('JSON 解析失败')
          }
        } else {
          const rows = parseCsv(text)
          onImported(rows)
        }
      }
      reader.readAsText(file)
      return false
    },
    [onImported],
  )

  const props: UploadProps = {
    beforeUpload: handleFile,
    multiple: false,
    accept: '.csv,.json',
    showUploadList: false,
  }

  return (
    <Modal title="导入数据" open={open} onCancel={onClose} onOk={onClose} okText="关闭" cancelButtonProps={{ style: { display: 'none' } }}>
      <Upload.Dragger {...props} style={{ marginBottom: 12 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">拖拽或点击上传 CSV / JSON</p>
        <p className="ant-upload-hint">CSV 第一行为表头，编码 UTF-8；JSON 必须是数组</p>
      </Upload.Dragger>
      {templateNote && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          模板：{templateNote}
        </Typography.Paragraph>
      )}
    </Modal>
  )
}
