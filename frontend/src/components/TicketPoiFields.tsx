import { Form, Input, Select, TimePicker, Checkbox, Radio } from 'antd'
import dayjs from 'dayjs'

const { TextArea } = Input

/**
 * 门票POI的通用字段组件
 * 这些字段所有该POI下的门票资源共享
 */
export default function TicketPoiFields({ prefix = ['attrs'] }: { prefix?: (string | number)[] }) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
            <h4 style={{ marginBottom: 16, color: '#fa8c16' }}>🏞️ 门票POI通用信息（所有门票资源共享）</h4>

            {/* 地理位置信息 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>📍 地理位置</h5>

                <Form.Item name={[...prefix, 'province']} label="省份">
                    <Input placeholder="例如：北京" />
                </Form.Item>

                <Form.Item name={[...prefix, 'district']} label="区/县">
                    <Input placeholder="例如：朝阳区" />
                </Form.Item>

                <Form.Item name={[...prefix, 'address']} label="详细地址" rules={[{ required: true, message: '请输入详细地址' }]}>
                    <Input placeholder="景区/场馆详细地址" />
                </Form.Item>
            </div>

            {/* 入园信息 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>🎫 入园信息</h5>

                <Form.Item name={[...prefix, 'entrance_times']} label="入园次数" rules={[{ required: true }]}>
                    <Select placeholder="选择入园次数">
                        <Select.Option value="unlimited">无限进入</Select.Option>
                        <Select.Option value="1">1次</Select.Option>
                        <Select.Option value="2">2次</Select.Option>
                        <Select.Option value="3">3次</Select.Option>
                    </Select>
                </Form.Item>

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

                <Form.Item name={[...prefix, 'entry_method']} label="入园方式">
                    <Input placeholder="例如：刷身份证/扫码/人工检票" />
                </Form.Item>
            </div>

            {/* 联系与服务 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>📞 联系与服务</h5>

                <Form.Item name={[...prefix, 'phone']} label="联系电话">
                    <Input placeholder="景区/场馆联系电话" />
                </Form.Item>

                <Form.Item name={[...prefix, 'description']} label="详细介绍">
                    <TextArea rows={3} placeholder="景区详细介绍" />
                </Form.Item>
            </div>

            {/* 取票信息 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>🎟️ 取票信息</h5>

                <Form.Item name={[...prefix, 'pickup_location']} label="取票地址" rules={[{ required: true }]}>
                    <Input placeholder="取票/兑换地点" />
                </Form.Item>

                <Form.Item name={[...prefix, 'pickup_method']} label="取票方式">
                    <Input placeholder="例如：现场取票/电子票/快递" />
                </Form.Item>
            </div>

            {/* 游客信息要求 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>👤 游客信息要求</h5>

                <Form.Item name={[...prefix, 'required_traveler_info']} label="所需出行人信息" rules={[{ required: true }]}>
                    <Checkbox.Group>
                        <Checkbox value="身份证">身份证</Checkbox>
                        <Checkbox value="手机号">手机号</Checkbox>
                        <Checkbox value="姓名">姓名</Checkbox>
                    </Checkbox.Group>
                </Form.Item>

                <Form.Item name={[...prefix, 'voucher_type']} label="凭证类型" rules={[{ required: true }]}>
                    <Checkbox.Group>
                        <Checkbox value="身份证">身份证</Checkbox>
                        <Checkbox value="二维码">二维码</Checkbox>
                        <Checkbox value="手机号">手机号</Checkbox>
                    </Checkbox.Group>
                </Form.Item>

                <Form.Item name={[...prefix, 'purchase_limit']} label="限购规则">
                    <Input placeholder="例如：每个身份证限购5张" />
                </Form.Item>
            </div>

            {/* 配套设施 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>🏗️ 配套设施</h5>

                <Form.Item name={[...prefix, 'has_parking']} label="是否有停车场">
                    <Radio.Group>
                        <Radio value={true}>有</Radio>
                        <Radio value={false}>无</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item name={[...prefix, 'parking_info']} label="停车场信息">
                    <Input placeholder="例如：免费/收费/车位数等" />
                </Form.Item>

                <Form.Item name={[...prefix, 'transportation_info']} label="园内交通信息">
                    <TextArea rows={2} placeholder="观光车/索道等" />
                </Form.Item>

                <Form.Item name={[...prefix, 'has_luggage_storage']} label="是否有行李寄存">
                    <Radio.Group>
                        <Radio value={true}>有</Radio>
                        <Radio value={false}>无</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item name={[...prefix, 'toilet_info']} label="卫生间信息">
                    <Input placeholder="位置分布等" />
                </Form.Item>
            </div>

            {/* 特色与说明 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>✨ 特色与说明</h5>

                <Form.Item name={[...prefix, 'highlights']} label="景区亮点">
                    <TextArea rows={2} placeholder="景区特色与亮点" />
                </Form.Item>

                <Form.Item name={[...prefix, 'invoice_info']} label="发票说明">
                    <Input placeholder="发票开具相关说明" />
                </Form.Item>

                <Form.Item name={[...prefix, 'remark']} label="备注">
                    <TextArea rows={2} placeholder="其他补充说明" />
                </Form.Item>
            </div>
        </div>
    )
}
