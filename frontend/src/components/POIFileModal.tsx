import { Modal, Button } from 'antd'
import POIFileManager from './POIFileManager'
import type { POI } from '@/types'

interface POIFileModalProps {
    poi: POI | null
    open: boolean
    onClose: () => void
}

/**
 * POI详情图管理Modal
 * 创建POI后弹出，让用户上传详情图片
 */
const POIFileModal: React.FC<POIFileModalProps> = ({ poi, open, onClose }) => {
    if (!poi) return null

    return (
        <Modal
            title={`上传详情图 - ${poi.poi_name}`}
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
                ✅ POI <strong>{poi.poi_name}</strong> 已创建成功！您可以在此上传详情图片，也可以跳过此步骤稍后上传。
            </div>
            <POIFileManager
                poiFolderId={poi.folder_id || null}
                poiName={poi.poi_name}
                readonly={false}
            />
        </Modal>
    )
}

export default POIFileModal
