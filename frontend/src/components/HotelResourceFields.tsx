import { Form, Input, InputNumber, Select, Radio } from 'antd'
import EditableSelect from '@/components/EditableSelect'
import type { ResourceFieldsProps } from './TicketResourceFields'

const { TextArea } = Input

/**
 * 酒店资源的独属字段组件
 * POI层已定义通用字段（地址、电话等）
 */
export default function HotelResourceFields({ prefix = ['attrs'], typeOptions, onOptionsChange, onOptionAdd, onOptionDelete, onOptionRename }: ResourceFieldsProps) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#f9f0ff', borderRadius: 8, border: '1px solid #d3adf7' }}>
            <h4 style={{ marginBottom: 16, color: '#722ed1' }}>🛏️ 酒店房型独属信息</h4>
            <p style={{ marginBottom: 16, color: '#666', fontSize: 12 }}>
                提示：通用字段（设施、地址、电话等）已在资源层设置，此处只需填写该房型的特有属性
            </p>

            <Form.Item name={[...prefix, 'room_type']} label="房型" rules={[{ required: true, message: '请选择房型' }]}>
                <EditableSelect
                    placeholder="选择房型"
                    defaultOptions={['标准', '行政', '豪华', '套房', '大床房', '双床房', '家庭房']}
                    customOptions={typeOptions?.['room_type']}
                    onOptionsChange={(opts) => onOptionsChange?.('room_type', opts)}
                    onOptionAdd={(val) => onOptionAdd?.('room_type', val)}
                    onOptionDelete={(val) => onOptionDelete?.('room_type', val)}
                    onOptionRename={(oldVal, newVal) => onOptionRename?.('room_type', oldVal, newVal)}
                />
            </Form.Item>

            <Form.Item name={[...prefix, 'bed_type']} label="床型">
                <EditableSelect
                    placeholder="选择床型"
                    defaultOptions={['大床', '双床', '单人床', '多张床']}
                    customOptions={typeOptions?.['bed_type']}
                    onOptionsChange={(opts) => onOptionsChange?.('bed_type', opts)}
                    onOptionAdd={(val) => onOptionAdd?.('bed_type', val)}
                    onOptionDelete={(val) => onOptionDelete?.('bed_type', val)}
                    onOptionRename={(oldVal, newVal) => onOptionRename?.('bed_type', oldVal, newVal)}
                />
            </Form.Item>

            <Form.Item name={[...prefix, 'max_occupancy']} label="最大入住人数" rules={[{ required: true, message: '请输入最大入住人数' }]}>
                <InputNumber min={1} style={{ width: '100%' }} addonAfter="人" />
            </Form.Item>

            <Form.Item name={[...prefix, 'breakfast_included']} label="包含早餐">
                <Radio.Group>
                    <Radio value={true}>含早</Radio>
                    <Radio value={false}>不含</Radio>
                </Radio.Group>
            </Form.Item>

            <Form.Item name={[...prefix, 'area']} label="房间面积">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="㎡" />
            </Form.Item>

            <Form.Item name={[...prefix, 'advance_booking_days']} label="提前预定天数">
                <InputNumber min={0} style={{ width: '100%' }} addonAfter="天" />
            </Form.Item>

            <Form.Item name={[...prefix, 'has_window']} label="是否有窗">
                <Radio.Group>
                    <Radio value={true}>有窗</Radio>
                    <Radio value={false}>无窗</Radio>
                </Radio.Group>
            </Form.Item>

            <Form.Item name={[...prefix, 'room_facilities']} label="房间配套设施">
                <Select mode="tags" placeholder="输入设施并回车，如：Wifi、吹风机" tokenSeparators={[',', ' ']} />
            </Form.Item>

            <Form.Item name={[...prefix, 'additional_notes']} label="备注">
                <TextArea rows={3} placeholder="其他房型说明" />
            </Form.Item>
        </div>
    )
}
