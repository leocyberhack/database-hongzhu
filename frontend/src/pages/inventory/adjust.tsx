import { Form, Input, InputNumber, Button, Select, DatePicker } from 'antd'
import { useEffect } from 'react'
import { useData } from '@/contexts/DataContext'

export default function InventoryAdjustPage() {
    const { data, loadData } = useData()
    const skus = data.skus ?? []
    const channels = data.channels ?? []

    useEffect(() => {
        loadData(['skus', 'channels'])
    }, [loadData])

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">库存调整</h1>
                <p className="page-subtitle">手动调整库存数量</p>
            </div>

            <div className="glass-card" style={{ padding: '24px', maxWidth: '600px' }}>
                <Form layout="vertical">
                    <Form.Item label="SKU" name="sku_id" rules={[{ required: true }]}>
                        <Select placeholder="选择SKU" options={skus.map((s) => ({ value: s.id, label: s.sku_name }))} />
                    </Form.Item>
                    <Form.Item label="渠道" name="channel_id" rules={[{ required: true }]}>
                        <Select placeholder="选择渠道" options={channels.map((c) => ({ value: c.id, label: c.channel_name }))} />
                    </Form.Item>
                    <Form.Item label="日期" name="date" rules={[{ required: true }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="调整数量" name="quantity" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} placeholder="正数增加，负数减少" />
                    </Form.Item>
                    <Form.Item label="调整原因" name="reason">
                        <Input.TextArea rows={3} placeholder="请说明调整原因" />
                    </Form.Item>
                    <Button type="primary" size="large">提交调整</Button>
                </Form>
            </div>
        </div>
    )
}
