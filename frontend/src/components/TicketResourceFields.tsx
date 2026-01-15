import { Form, Input, Select, InputNumber, TimePicker, Checkbox } from 'antd'
import dayjs from 'dayjs'

const { TextArea } = Input

export default function TicketResourceFields({ prefix = ['attrs'] }: { prefix?: (string | number)[] }) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#f0f7ff', borderRadius: 8, border: '1px solid #d0e8ff' }}>
            <h4 style={{ marginBottom: 16, color: '#1890ff' }}>📱 门票特定信息</h4>

            {/* 票种 */}
            <Form.Item
                name={[...prefix, 'ticket_type']}
                label="票种"
                rules={[{ required: true, message: '请选择票种' }]}
            >
                <Select placeholder="选择票种">
                    <Select.Option value="成人票">成人票</Select.Option>
                    <Select.Option value="儿童票">儿童票</Select.Option>
                    <Select.Option value="学生票">学生票</Select.Option>
                    <Select.Option value="老人票">老人票</Select.Option>
                    <Select.Option value="双人票">双人票</Select.Option>
                </Select>
            </Form.Item>

            {/* 地址 */}
            <Form.Item
                name={[...prefix, 'address']}
                label="地址"
                rules={[{ required: true, message: '请输入地址' }]}
            >
                <Input placeholder="请输入景区/场馆详细地址" />
            </Form.Item>

            {/* 入园次数 */}
            <Form.Item
                name={[...prefix, 'entrance_times']}
                label="入园次数"
                rules={[{ required: true, message: '请选择入园次数' }]}
            >
                <Select placeholder="选择入园次数">
                    <Select.Option value="unlimited">无限进入</Select.Option>
                    <Select.Option value="1">1次</Select.Option>
                    <Select.Option value="2">2次</Select.Option>
                    <Select.Option value="3">3次</Select.Option>
                </Select>
            </Form.Item>

            {/* 年龄限制 */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8 }}>年龄限制（岁，包含）</div>
                <Input.Group compact>
                    <Form.Item
                        name={[...prefix, 'age_limit', 'min']}
                        noStyle
                        rules={[{ required: true, message: '最小年龄必填' }]}
                    >
                        <InputNumber placeholder="最小年龄" min={0} max={150} style={{ width: '48%' }} />
                    </Form.Item>
                    <span style={{ display: 'inline-block', width: '4%', textAlign: 'center', lineHeight: '32px' }}>-</span>
                    <Form.Item
                        name={[...prefix, 'age_limit', 'max']}
                        noStyle
                        rules={[{ required: true, message: '最大年龄必填' }]}
                    >
                        <InputNumber placeholder="最大年龄" min={0} max={150} style={{ width: '48%' }} />
                    </Form.Item>
                </Input.Group>
            </div>

            {/* 门票包含内容 */}
            <Form.Item
                name={[...prefix, 'includes']}
                label="门票包含内容"
            >
                <TextArea rows={2} placeholder="例如：景区大门票、观光车（可选）" />
            </Form.Item>

            {/* 门票不包含内容 */}
            <Form.Item
                name={[...prefix, 'excludes']}
                label="门票不包含内容"
            >
                <TextArea rows={2} placeholder="例如：索道、游船（可选）" />
            </Form.Item>

            {/* 入园时间 */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8 }}>入园时间</div>
                <Input.Group compact>
                    <Form.Item
                        name={[...prefix, 'earliest_entry_time']}
                        noStyle
                        rules={[{ required: true, message: '最早入园时间必填' }]}
                        getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                        getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                    >
                        <TimePicker placeholder="最早入园时间" format="HH:mm" style={{ width: '48%' }} />
                    </Form.Item>
                    <span style={{ display: 'inline-block', width: '4%', textAlign: 'center', lineHeight: '32px' }}>-</span>
                    <Form.Item
                        name={[...prefix, 'latest_entry_time']}
                        noStyle
                        rules={[{ required: true, message: '最晚入园时间必填' }]}
                        getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                        getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                    >
                        <TimePicker placeholder="最晚入园时间" format="HH:mm" style={{ width: '48%' }} />
                    </Form.Item>
                </Input.Group>
            </div>

            {/* 需提前预定天数 */}
            <Form.Item
                name={[...prefix, 'advance_booking_days']}
                label="需提前预定天数"
                rules={[{ required: true, message: '请输入提前预定天数' }]}
            >
                <InputNumber placeholder="例如：1（当天预定第二天使用）" min={0} style={{ width: '100%' }} addonAfter="天" />
            </Form.Item>

            {/* 需提前预定时间（小时/分钟）*/}
            <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8 }}>需提前预定时间</div>
                <Input.Group compact>
                    <Form.Item
                        name={[...prefix, 'advance_booking_time', 'hours']}
                        noStyle
                        rules={[{ required: true, message: '小时必填' }]}
                    >
                        <InputNumber placeholder="小时" min={0} max={23} style={{ width: '48%' }} addonAfter="时" />
                    </Form.Item>
                    <span style={{ display: 'inline-block', width: '4%', textAlign: 'center', lineHeight: '32px' }}></span>
                    <Form.Item
                        name={[...prefix, 'advance_booking_time', 'minutes']}
                        noStyle
                        rules={[{ required: true, message: '分钟必填' }]}
                    >
                        <InputNumber placeholder="分钟" min={0} max={59} style={{ width: '48%' }} addonAfter="分" />
                    </Form.Item>
                </Input.Group>
            </div>

            {/* 电话 */}
            <Form.Item
                name={[...prefix, 'phone']}
                label="联系电话"
            >
                <Input placeholder="景区/场馆联系电话（可选）" />
            </Form.Item>

            {/* 详细介绍 */}
            <Form.Item
                name={[...prefix, 'description']}
                label="详细介绍"
            >
                <TextArea rows={3} placeholder="门票详细介绍（可选）" />
            </Form.Item>

            {/* 取票地址 */}
            <Form.Item
                name={[...prefix, 'pickup_location']}
                label="取票地址"
                rules={[{ required: true, message: '请输入取票地址' }]}
            >
                <Input placeholder="取票/兑换地点" />
            </Form.Item>

            {/* 出票后多久可用 */}
            <Form.Item
                name={[...prefix, 'available_after_issue']}
                label="出票后多久可用"
                rules={[{ required: true, message: '请输入可用时间' }]}
            >
                <Input placeholder="例如：立即可用 / 24小时后可用" />
            </Form.Item>

            {/* 所需出行人信息 */}
            <Form.Item
                name={[...prefix, 'required_traveler_info']}
                label="所需出行人信息"
                rules={[{ required: true, message: '请选择所需信息' }]}
            >
                <Checkbox.Group>
                    <Checkbox value="身份证">身份证</Checkbox>
                    <Checkbox value="手机号">手机号</Checkbox>
                    <Checkbox value="姓名">姓名</Checkbox>
                </Checkbox.Group>
            </Form.Item>

            {/* 凭证类型 */}
            <Form.Item
                name={[...prefix, 'voucher_type']}
                label="凭证类型"
                rules={[{ required: true, message: '请选择凭证类型' }]}
            >
                <Checkbox.Group>
                    <Checkbox value="身份证">身份证</Checkbox>
                    <Checkbox value="二维码">二维码</Checkbox>
                    <Checkbox value="手机号">手机号</Checkbox>
                </Checkbox.Group>
            </Form.Item>

            {/* 限购规则 */}
            <Form.Item
                name={[...prefix, 'purchase_limit']}
                label="限购规则"
            >
                <Input placeholder="例如：每个身份证限购5张" />
            </Form.Item>

            {/* 退票规则 */}
            <Form.Item
                name={[...prefix, 'refund_policy']}
                label="退票规则"
            >
                <TextArea rows={2} placeholder="例如：使用前24小时可免费退票" />
            </Form.Item>

            {/* 游玩时间（小时） */}
            <Form.Item
                name={[...prefix, 'play_duration']}
                label="游玩时间（小时）"
            >
                <InputNumber placeholder="游玩时长" min={0} step={0.5} style={{ width: '100%' }} addonAfter="小时" />
            </Form.Item>

            {/* 补充说明 */}
            <Form.Item
                name={[...prefix, 'additional_notes']}
                label="补充说明"
            >
                <TextArea rows={3} placeholder="其他需要说明的内容（可选）" />
            </Form.Item>
        </div>
    )
}
