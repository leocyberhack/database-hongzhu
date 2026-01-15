import { Form, Input, Select, TimePicker, Checkbox } from 'antd'
import dayjs from 'dayjs'

const { TextArea } = Input

export default function DiningResourceFields({ prefix = ['attrs'] }: { prefix?: (string | number)[] }) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <h4 style={{ marginBottom: 16, color: '#52c41a' }}>🍽️ 餐饮特定信息</h4>

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

            {/* 2. 正餐 or 小吃 */}
            <Form.Item
                name={[...prefix, 'dining_category']}
                label="餐饮分类"
                rules={[{ required: true, message: '请选择餐饮分类' }]}
            >
                <Select placeholder="选择餐饮分类">
                    <Select.Option value="正餐">正餐</Select.Option>
                    <Select.Option value="小吃">小吃</Select.Option>
                </Select>
            </Form.Item>

            {/* 3. 餐厅名称 */}
            <Form.Item
                name={[...prefix, 'restaurant_name']}
                label="餐厅名称"
                rules={[{ required: true, message: '请输入餐厅名称' }]}
            >
                <Input placeholder="请输入餐厅名称" />
            </Form.Item>

            {/* 4. 餐厅地址 */}
            <Form.Item
                name={[...prefix, 'restaurant_address']}
                label="餐厅地址"
                rules={[{ required: true, message: '请输入餐厅地址' }]}
            >
                <Input placeholder="请输入餐厅详细地址" />
            </Form.Item>

            {/* 5. 电话 */}
            <Form.Item
                name={[...prefix, 'phone']}
                label="联系电话"
            >
                <Input placeholder="餐厅联系电话（可选）" />
            </Form.Item>

            {/* 6. 餐厅营业时间（开始-结束） */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8 }}>营业时间</div>
                <Input.Group compact>
                    <Form.Item
                        name={[...prefix, 'opening_time']}
                        noStyle
                        rules={[{ required: true, message: '营业开始时间必填' }]}
                        getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                        getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                    >
                        <TimePicker placeholder="营业开始时间" format="HH:mm" style={{ width: '48%' }} />
                    </Form.Item>
                    <span style={{ display: 'inline-block', width: '4%', textAlign: 'center', lineHeight: '32px' }}>-</span>
                    <Form.Item
                        name={[...prefix, 'closing_time']}
                        noStyle
                        rules={[{ required: true, message: '营业结束时间必填' }]}
                        getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                        getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                    >
                        <TimePicker placeholder="营业结束时间" format="HH:mm" style={{ width: '48%' }} />
                    </Form.Item>
                </Input.Group>
            </div>

            {/* 7. 是否需要预定 */}
            <Form.Item
                name={[...prefix, 'reservation_required']}
                label="是否需要预定"
                valuePropName="checked"
            >
                <Checkbox>需要预定</Checkbox>
            </Form.Item>

            {/* 8. 补充说明 */}
            <Form.Item
                name={[...prefix, 'additional_notes']}
                label="补充说明"
            >
                <TextArea rows={3} placeholder="其他需要说明的内容（可选）" />
            </Form.Item>
        </div>
    )
}
