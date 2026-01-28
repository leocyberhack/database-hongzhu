import { Modal, Button } from 'antd'
import POIFileManager from './POIFileManager'
import type { Supplier } from '@/types'

interface SupplierFileModalProps {
    supplier: Supplier | null
    open: boolean
    onClose: () => void
}

/**
 * 供应商文件管理 Modal
 * 创建/编辑供应商时用于上传合同、协议等文件
 */
const SupplierFileModal: React.FC<SupplierFileModalProps> = ({ supplier, open, onClose }) => {
    if (!supplier) return null

    return (
        <Modal
            title={`上传合同文件 - ${supplier.supplier_name}`}
            open={open}
            onCancel={onClose}
            footer={
                <div style={{ textAlign: 'right' }}>
                    <Button onClick={onClose}>
                        完成
                    </Button>
                </div>
            }
            width={800}
            destroyOnClose
        >
            <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 4, fontSize: 13 }}>
                ✅ 供应商 <strong>{supplier.supplier_name}</strong> 已创建完成！
                可在此上传合同、协议等文件，也可稍后在编辑中继续上传。
            </div>
            <POIFileManager
                poiFolderId={supplier.folder_id || null}
                poiName={supplier.supplier_name}
                entityLabel="供应商"
                readonly={false}
            />
        </Modal>
    )
}

export default SupplierFileModal
