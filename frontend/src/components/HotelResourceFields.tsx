import { Form, Input, Select, InputNumber, TimePicker, Checkbox } from 'antd'
import dayjs from 'dayjs'

const { TextArea } = Input

export default function HotelResourceFields() {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
            <h4 style={{ marginBottom: 16, color: '#fa8c16' }}>🏨 酒店特定信息</h4>

            {/* 1. 房型 */}
            <Form.Item
                name={['attrs', 'room_type']}
                label="房型"
                rules={[{ required: true, message: '请选择房型' }]}
            >
                <Select placeholder="选择房型">
                    <Select.Option value="标准">标准</Select.Option>
                    <Select.Option value="行政">行政</Select.Option>
                    <Select.Option value="豪华">豪华</Select.Option>
                    <Select.Option value="套房">套房</Select.Option>
                </Select>
            </Form.Item>

            {/* 2. 床型 */}
            <Form.Item
                name={['attrs', 'bed_type']}
                label="床型"
                rules={[{ required: true, message: '请选择床型' }]}
            >
                <Select placeholder="选择床型">
                    <Select.Option value="大床">大床</Select.Option>
                    <Select.Option value="双床">双床</Select.Option>
                    <Select.Option value="亲子">亲子</Select.Option>
                </Select>
            </Form.Item>

            {/* 3. 酒店类型 */}
            <Form.Item
                name={['attrs', 'hotel_type']}
                label="酒店类型"
                rules={[{ required: true, message: '请选择酒店类型' }]}
            >
                <Select placeholder="选择酒店类型">
                    <Select.Option value="经济型">经济型</Select.Option>
                    <Select.Option value="豪华型">豪华型</Select.Option>
                </Select>
            </Form.Item>

            {/* 4. 电话 */}
            <Form.Item
                name={['attrs', 'phone']}
                label="联系电话"
            >
                <Input placeholder="酒店联系电话（可选）" />
            </Form.Item>

            {/* 5. 详细地址 */}
            <Form.Item
                name={['attrs', 'address']}
                label="详细地址"
                rules={[{ required: true, message: '请输入详细地址' }]}
            >
                <Input placeholder="请输入酒店详细地址" />
            </Form.Item>

            {/* 6. 最大入住人数 */}
            <Form.Item
                name={['attrs', 'max_occupancy']}
                label="最大入住人数"
                rules={[{ required: true, message: '请输入最大入住人数' }]}
            >
                <InputNumber placeholder="最大入住人数" min={1} max={20} style={{ width: '100%' }} addonAfter="人" />
            </Form.Item>

            {/* 7. 是否含早餐 */}
            <Form.Item
                name={['attrs', 'breakfast_included']}
                label="是否含早餐"
                valuePropName="checked"
            >
                <Checkbox>含早餐</Checkbox>
            </Form.Item>

            {/* 8. 酒店星级 */}
            <Form.Item
                name={['attrs', 'star_rating']}
                label="酒店星级"
                rules={[{ required: true, message: '请选择酒店星级' }]}
            >
                <Select placeholder="选择星级">
                    <Select.Option value="五星">五星</Select.Option>
                    <Select.Option value="四星">四星</Select.Option>
                    <Select.Option value="三星">三星</Select.Option>
                    <Select.Option value="无">无</Select.Option>
                </Select>
            </Form.Item>

            {/* 9. 取消/退款政策 */}
            <Form.Item
                name={['attrs', 'cancellation_policy']}
                label="取消/退款政策"
            >
                <TextArea rows={2} placeholder="例如：入住前24小时可免费取消" />
            </Form.Item>

            {/* 10. 限购规则 */}
            <Form.Item
                name={['attrs', 'purchase_limit']}
                label="限购规则"
            >
                <Input placeholder="例如：每个身份证限订3间" />
            </Form.Item>

            {/* 11. 所需出行人信息 */}
            <Form.Item
                name={['attrs', 'required_traveler_info']}
                label="所需出行人信息"
                rules={[{ required: true, message: '请选择所需信息' }]}
            >
                <Checkbox.Group>
                    <Checkbox value="身份证">身份证</Checkbox>
                    <Checkbox value="手机号">手机号</Checkbox>
                    <Checkbox value="姓名">姓名</Checkbox>
                </Checkbox.Group>
            </Form.Item>

            {/* 12. 详细介绍 */}
            <Form.Item
                name={['attrs', 'description']}
                label="详细介绍"
            >
                <TextArea rows={3} placeholder="酒店详细介绍（可选）" />
            </Form.Item>

            {/* 13-14. 入住退房时间 */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8 }}>入住/退房时间</div>
                <Input.Group compact>
                    <Form.Item
                        name={['attrs', 'check_in_time']}
                        noStyle
                        rules={[{ required: true, message: '最早入住时间必填' }]}
                        getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                        getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                    >
                        <TimePicker placeholder="最早入住时间" format="HH:mm" style={{ width: '48%' }} />
                    </Form.Item>
                    <span style={{ display: 'inline-block', width: '4%', textAlign: 'center', lineHeight: '32px' }}>-</span>
                    <Form.Item
                        name={['attrs', 'check_out_time']}
                        noStyle
                        rules={[{ required: true, message: '最晚退房时间必填' }]}
                        getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                        getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                    >
                        <TimePicker placeholder="最晚退房时间" format="HH:mm" style={{ width: '48%' }} />
                    </Form.Item>
                </Input.Group>
            </div>

            {/* 15. 提前预定天数 */}
            <Form.Item
                name={['attrs', 'advance_booking_days']}
                label="需提前预定天数"
                rules={[{ required: true, message: '请输入提前预定天数' }]}
            >
                <InputNumber placeholder="例如：1（当天预定第二天入住）" min={0} style={{ width: '100%' }} addonAfter="天" />
            </Form.Item>

            {/* 16. 停车场 */}
            <Form.Item
                name={['attrs', 'parking']}
                label="停车场"
                rules={[{ required: true, message: '请选择停车场情况' }]}
            >
                <Select placeholder="选择停车场情况">
                    <Select.Option value="无">无</Select.Option>
                    <Select.Option value="免费">免费</Select.Option>
                    <Select.Option value="付费">付费</Select.Option>
                </Select>
            </Form.Item>

            {/* 17-20. 酒店服务设施（布尔值） */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>酒店服务设施</div>
                <div style={{ padding: '12px', background: '#fafafa', borderRadius: 4 }}>
                    <Form.Item
                        name={['attrs', 'has_pickup_service']}
                        valuePropName="checked"
                        style={{ marginBottom: 8 }}
                    >
                        <Checkbox>提供接机/接站服务</Checkbox>
                    </Form.Item>
                    <Form.Item
                        name={['attrs', 'has_24h_reception']}
                        valuePropName="checked"
                        style={{ marginBottom: 8 }}
                    >
                        <Checkbox>24小时前台</Checkbox>
                    </Form.Item>
                    <Form.Item
                        name={['attrs', 'has_luggage_storage']}
                        valuePropName="checked"
                        style={{ marginBottom: 8 }}
                    >
                        <Checkbox>可寄存行李</Checkbox>
                    </Form.Item>
                    <Form.Item
                        name={['attrs', 'has_restaurant']}
                        valuePropName="checked"
                        style={{ marginBottom: 0 }}
                    >
                        <Checkbox>有餐厅</Checkbox>
                    </Form.Item>
                </div>
            </div>

            {/* 21. 其他额外服务 */}
            <Form.Item
                name={['attrs', 'extra_services']}
                label="其他额外服务"
            >
                <TextArea rows={2} placeholder="例如：洗衣服务、健身房、游泳池等（可选）" />
            </Form.Item>

            {/* 22. 面积 */}
            <Form.Item
                name={['attrs', 'area']}
                label="房间面积（平米）"
            >
                <InputNumber placeholder="面积" min={0} style={{ width: '100%' }} addonAfter="㎡" />
            </Form.Item>

            {/* 23. 特殊结算规则 */}
            <Form.Item
                name={['attrs', 'special_settlement_rules']}
                label="特殊结算规则"
            >
                <TextArea rows={2} placeholder="特殊的结算规则说明（可选）" />
            </Form.Item>

            {/* 23. 补充说明 */}
            <Form.Item
                name={['attrs', 'additional_notes']}
                label="补充说明"
            >
                <TextArea rows={3} placeholder="其他需要说明的内容（可选）" />
            </Form.Item>
        </div>
    )
}
