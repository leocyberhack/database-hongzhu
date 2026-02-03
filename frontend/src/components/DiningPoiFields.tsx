import { Form, Input, TimePicker, Row, Col } from 'antd'
import dayjs from 'dayjs'

const { TextArea } = Input

/**
 * 餐饮POI的通用字段组件
 */
export default function DiningPoiFields({ prefix = ['attrs'] }: { prefix?: (string | number)[] }) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
            <h4 style={{ marginBottom: 16, color: '#fa8c16' }}>🍽️ 餐饮资源通用信息</h4>

            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name={[...prefix, 'restaurant_name']} label="餐厅名称">
                        <Input placeholder="输入餐厅名称" />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item name={[...prefix, 'phone']} label="联系电话">
                        <Input placeholder="餐厅联系电话" />
                    </Form.Item>
                </Col>
            </Row>

            <Form.Item name={[...prefix, 'parking']} label="停车场信息">
                <Input placeholder="例如：免费停车 / 收费停车场" />
            </Form.Item>

            <Form.Item name={[...prefix, 'description']} label="详细介绍">
                <TextArea rows={3} placeholder="餐厅特色、环境等详细介绍" />
            </Form.Item>

            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item
                        name={[...prefix, 'opening_time']}
                        label="营业开始时间"
                        getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                        getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                    >
                        <TimePicker format="HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        name={[...prefix, 'closing_time']}
                        label="营业结束时间"
                        getValueFromEvent={(time) => time ? dayjs(time).format('HH:mm') : null}
                        getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                    >
                        <TimePicker format="HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    )
}
