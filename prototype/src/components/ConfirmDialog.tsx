import { Modal } from 'antd'

export const confirmAction = (title: string, content: string, onOk: () => void) => {
  Modal.confirm({
    title,
    content,
    okText: '确认',
    cancelText: '取消',
    onOk,
  })
}
