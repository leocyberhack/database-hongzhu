import { Form, Input, Select, TimePicker, Checkbox, Radio, Row, Col } from 'antd'
import dayjs from 'dayjs'

const { TextArea } = Input

/**
 * 酒店POI的通用字段组件
 * 这些字段所有该POI下的酒店房型资源共享
 */
export default function HotelPoiFields({ prefix = ['attrs'] }: { prefix?: (string | number)[] }) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
            <h4 style={{ marginBottom: 16, color: '#52c41a' }}>🏨 酒店POI通用信息（所有房型共享）</h4>

            {/* 基础信息 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>📍 基础信息</h5>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name={[...prefix, 'hotel_type']} label="酒店类型" rules={[{ required: true }]}>
                            <Select placeholder="选择酒店类型">
                                <Select.Option value="经济型">经济型</Select.Option>
                                <Select.Option value="舒适型">舒适型</Select.Option>
                                <Select.Option value="高档型">高档型</Select.Option>
                                <Select.Option value="豪华型">豪华型</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name={[...prefix, 'star_rating']} label="酒店星级">
                            <Select placeholder="选择星级">
                                <Select.Option value="五星">五星</Select.Option>
                                <Select.Option value="四星">四星</Select.Option>
                                <Select.Option value="三星">三星</Select.Option>
                                <Select.Option value="二星">二星</Select.Option>
                                <Select.Option value="无">无</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name={[...prefix, 'address']} label="详细地址" rules={[{ required: true }]}>
                    <Input placeholder="酒店详细地址" />
                </Form.Item>

                <Form.Item name={[...prefix, 'phone']} label="联系电话" rules={[{ required: true }]}>
                    <Input placeholder="酒店前台电话" />
                </Form.Item>

                <Form.Item name={[...prefix, 'description']} label="详细介绍">
                    <TextArea rows={3} placeholder="酒店概况描述" />
                </Form.Item>
            </div>

            {/* 政策与时间 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>🕒 政策与时间</h5>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name={[...prefix, 'check_in_time']}
                            label="最早入住时间"
                            getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                            getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                        >
                            <TimePicker format="HH:mm" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name={[...prefix, 'check_out_time']}
                            label="最晚退房时间"
                            getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                            getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                        >
                            <TimePicker format="HH:mm" style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name={[...prefix, 'cancellation_policy']} label="取消/退款政策">
                    <TextArea rows={2} placeholder="例如：入住前24小时免费取消" />
                </Form.Item>

                <Form.Item name={[...prefix, 'purchase_limit']} label="限购政策">
                    <Input placeholder="例如：每单限订3间" />
                </Form.Item>

                <Form.Item name={[...prefix, 'required_traveler_info']} label="所需出行人信息">
                    <Checkbox.Group>
                        <Checkbox value="姓名">姓名</Checkbox>
                        <Checkbox value="手机号">手机号</Checkbox>
                        <Checkbox value="身份证">身份证</Checkbox>
                    </Checkbox.Group>
                </Form.Item>
            </div>

            {/* 设施与服务 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                <h5 style={{ marginBottom: 12 }}>🛎️ 设施与服务</h5>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name={[...prefix, 'parking']} label="停车场">
                            <Select placeholder="停车场情况">
                                <Select.Option value="免费">免费</Select.Option>
                                <Select.Option value="付费">付费</Select.Option>
                                <Select.Option value="无">无</Select.Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name={[...prefix, 'has_restaurant']} label="是否有餐厅">
                            <Radio.Group>
                                <Radio value={true}>有</Radio>
                                <Radio value={false}>无</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name={[...prefix, 'has_24h_reception']} label="24小时前台">
                            <Radio.Group>
                                <Radio value={true}>是</Radio>
                                <Radio value={false}>否</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name={[...prefix, 'has_luggage_storage']} label="行李寄存">
                            <Radio.Group>
                                <Radio value={true}>是</Radio>
                                <Radio value={false}>否</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item name={[...prefix, 'has_pickup_service']} label="接机/接站服务">
                    <Radio.Group>
                        <Radio value={true}>提供</Radio>
                        <Radio value={false}>不提供</Radio>
                    </Radio.Group>
                </Form.Item>

                <Form.Item name={[...prefix, 'extra_services']} label="其他额外服务">
                    <TextArea rows={2} placeholder="例如：叫醒服务、租车服务等" />
                </Form.Item>
            </div>

            <Form.Item name={[...prefix, 'additional_notes']} label="补充说明">
                <TextArea rows={2} placeholder="其他补充信息" />
            </Form.Item>
        </div>
    )
}
