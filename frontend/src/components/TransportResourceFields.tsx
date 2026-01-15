import { Form, Input, Select, InputNumber } from 'antd'

const { TextArea } = Input

export default function TransportResourceFields({ prefix = ['attrs'] }: { prefix?: (string | number)[] }) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
            <h4 style={{ marginBottom: 16, color: '#1890ff' }}>🚌 交通特定信息</h4>

            {/* 1. 交通类型 */}
            <Form.Item
                name={[...prefix, 'transport_type']}
                label="交通类型"
                rules={[{ required: true, message: '请选择交通类型' }]}
            >
                <Select placeholder="选择交通类型">
                    <Select.Option value="大巴">大巴</Select.Option>
                    <Select.Option value="商务车">商务车</Select.Option>
                    <Select.Option value="轿车">轿车</Select.Option>
                </Select>
            </Form.Item>

            {/* 2. 起点 */}
            <Form.Item
                name={[...prefix, 'departure']}
                label="起点"
                rules={[{ required: true, message: '请输入起点' }]}
            >
                <Input placeholder="请输入起点地址" />
            </Form.Item>

            {/* 3. 终点 */}
            <Form.Item
                name={[...prefix, 'destination']}
                label="终点"
                rules={[{ required: true, message: '请输入终点' }]}
            >
                <Input placeholder="请输入终点地址" />
            </Form.Item>

            {/* 4. 最大座位数 */}
            <Form.Item
                name={[...prefix, 'max_seats']}
                label="最大座位数"
                rules={[{ required: true, message: '请输入最大座位数' }]}
            >
                <InputNumber placeholder="最大座位数" min={1} max={60} style={{ width: '100%' }} addonAfter="座" />
            </Form.Item>

            {/* 5. 行程时长 */}
            <Form.Item
                name={[...prefix, 'duration']}
                label="行程时长"
                rules={[{ required: true, message: '请输入行程时长' }]}
            >
                <Input placeholder="例如：2小时30分钟" />
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
