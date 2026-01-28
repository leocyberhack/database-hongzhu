import { Form, Input, Checkbox, InputNumber } from 'antd'
import EditableSelect from '@/components/EditableSelect'
import type { ResourceFieldsProps } from './TicketResourceFields'

const { TextArea } = Input

export default function DiningResourceFields({ prefix = ['attrs'], typeOptions, onOptionsChange, onOptionAdd, onOptionDelete, onOptionRename }: ResourceFieldsProps) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <h4 style={{ marginBottom: 16, color: '#52c41a' }}>🍽️ 餐饮资源特定信息</h4>

            {/* 1. 餐饮类型（多选） */}
            <Form.Item
                name={[...prefix, 'meal_types']}
                label="餐饮类型"
                rules={[{ required: true, message: '请选择餐饮类型' }]}
            >
                <Checkbox.Group>
                    <Checkbox value="早餐">早餐</Checkbox>
                    <Checkbox value="午餐">午餐</Checkbox>
                    <Checkbox value="晚餐">晚餐</Checkbox>
                </Checkbox.Group>
            </Form.Item>

            {/* 2. 餐饮分类 */}
            <Form.Item
                name={[...prefix, 'dining_category']}
                label="餐饮分类"
                rules={[{ required: true, message: '请选择餐饮分类' }]}
            >
                <EditableSelect
                    placeholder="选择餐饮分类"
                    defaultOptions={['正餐', '小吃']}
                    customOptions={typeOptions?.['dining_category']}
                    onOptionsChange={(opts) => onOptionsChange?.('dining_category', opts)}
                    onOptionAdd={(val) => onOptionAdd?.('dining_category', val)}
                    onOptionDelete={(val) => onOptionDelete?.('dining_category', val)}
                    onOptionRename={(oldVal, newVal) => onOptionRename?.('dining_category', oldVal, newVal)}
                />
            </Form.Item>

            {/* 3. 包含内容详情 */}
            <Form.Item
                name={[...prefix, 'includes_details']}
                label="包含内容详情"
            >
                <TextArea rows={3} placeholder="详细描述套餐包含的内容，如菜品明细等" />
            </Form.Item>

            {/* 4. 适配人数 */}
            <Form.Item
                name={[...prefix, 'suitable_for_people']}
                label="适配人数"
                rules={[{ required: true, message: '请输入适配人数' }]}
            >
                <InputNumber min={1} placeholder="例如: 2" style={{ width: '100%' }} addonAfter="人" />
            </Form.Item>

            {/* 5. 是否需要预定 */}
            <Form.Item
                name={[...prefix, 'reservation_required']}
                label="是否需要预定"
                valuePropName="checked"
            >
                <Checkbox>需要预定</Checkbox>
            </Form.Item>

            {/* 6. 补充说明 */}
            <Form.Item
                name={[...prefix, 'additional_notes']}
                label="补充说明"
            >
                <TextArea rows={3} placeholder="其他需要说明的内容（可选）" />
            </Form.Item>
        </div>
    )
}
