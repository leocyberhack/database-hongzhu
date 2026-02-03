import { Form, Input, InputNumber } from 'antd'
import EditableSelect from '@/components/EditableSelect'

const { TextArea } = Input

export interface ResourceFieldsProps {
    prefix?: (string | number)[]
    typeOptions?: Record<string, string[]>
    onOptionsChange?: (field: string, newOptions: string[]) => void
    onOptionAdd?: (field: string, val: string) => void
    onOptionDelete?: (field: string, val: string) => void
    onOptionRename?: (field: string, oldVal: string, newVal: string) => void
}

/**
 * 景区资源的独属字段组件（POI层已定义通用字段）
 * 只包含资源级别的个性化属性
 */
export default function TicketResourceFields({ prefix = ['attrs'], typeOptions, onOptionsChange, onOptionAdd, onOptionDelete, onOptionRename }: ResourceFieldsProps) {
    return (
        <div style={{ marginTop: 16, padding: 16, background: '#e6f7ff', borderRadius: 8, border: '1px solid #91d5ff' }}>
            <h4 style={{ marginBottom: 16, color: '#1890ff' }}>🎫 景区子资源独属信息</h4>
            <p style={{ marginBottom: 16, color: '#666', fontSize: 12 }}>
                提示：通用字段（地址、入园时间、联系电话等）已在资源层设置，此处只需填写该景区特有的属性
            </p>

            {/* 票种 */}
            <Form.Item
                name={[...prefix, 'ticket_type']}
                label="票种"
                rules={[{ required: true, message: '请选择票种' }]}
            >
                <EditableSelect
                    placeholder="选择票种"
                    defaultOptions={['成人票', '儿童票', '学生票', '老人票', '双人票', '家庭票', '团体票']}
                    customOptions={typeOptions?.['ticket_type']}
                    onOptionsChange={(opts) => onOptionsChange?.('ticket_type', opts)}
                    onOptionAdd={(val) => onOptionAdd?.('ticket_type', val)}
                    onOptionDelete={(val) => onOptionDelete?.('ticket_type', val)}
                    onOptionRename={(oldVal, newVal) => onOptionRename?.('ticket_type', oldVal, newVal)}
                />
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

            {/* 身高限制（新增） */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ marginBottom: 8 }}>身高限制（厘米，包含）<span style={{ color: '#999', fontSize: 12 }}>（可选）</span></div>
                <Input.Group compact>
                    <Form.Item name={[...prefix, 'height_limit', 'min']} noStyle>
                        <InputNumber placeholder="最小身高" min={0} max={250} style={{ width: '48%' }} addonAfter="cm" />
                    </Form.Item>
                    <span style={{ display: 'inline-block', width: '4%', textAlign: 'center', lineHeight: '32px' }}>-</span>
                    <Form.Item name={[...prefix, 'height_limit', 'max']} noStyle>
                        <InputNumber placeholder="最大身高" min={0} max={250} style={{ width: '48%' }} addonAfter="cm" />
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

            {/* 景区包含内容 */}
            <Form.Item name={[...prefix, 'includes']} label="景区包含内容">
                <TextArea rows={2} placeholder="例如：景区大景区、观光车（可选）" />
            </Form.Item>

            {/* 景区不包含内容 */}
            <Form.Item name={[...prefix, 'excludes']} label="景区不包含内容">
                <TextArea rows={2} placeholder="例如：索道、游船（可选）" />
            </Form.Item>

            {/* 出票后多久可用 */}
            <Form.Item
                name={[...prefix, 'available_after_issue']}
                label="出票后多久可用"
                rules={[{ required: true, message: '请输入可用时间' }]}
            >
                <Input placeholder="例如：立即可用 / 24小时后可用" />
            </Form.Item>

            {/* 退票规则 */}
            <Form.Item name={[...prefix, 'refund_policy']} label="退票规则">
                <TextArea rows={2} placeholder="例如：使用前24小时可免费退票" />
            </Form.Item>

            {/* 游玩时间（小时） */}
            <Form.Item name={[...prefix, 'play_duration']} label="建议游玩时间（小时）">
                <InputNumber placeholder="游玩时长" min={0} step={0.5} style={{ width: '100%' }} addonAfter="小时" />
            </Form.Item>

            {/* 补充说明 */}
            <Form.Item name={[...prefix, 'additional_notes']} label="补充说明">
                <TextArea rows={3} placeholder="该景区的其他需要说明的内容（可选）" />
            </Form.Item>
        </div>
    )
}
