import { useState, useEffect } from 'react'
import { Form, Checkbox, Divider, Alert } from 'antd'
import TicketResourceFields from './TicketResourceFields'
import HotelResourceFields from './HotelResourceFields'
import DiningResourceFields from './DiningResourceFields'
import TransportResourceFields from './TransportResourceFields'

// Define the available sub-types
const SUB_TYPES = [
    { label: '酒店', value: '酒店' },
    { label: '门票', value: '门票' },
    { label: '餐饮', value: '餐饮' },
    { label: '交通', value: '交通' },
]

export default function CombinedResourceFields({ form }: { form: any }) {
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])

    // Watch for external changes to attrs.included_types (e.g. edit mode)
    useEffect(() => {
        const currentAttrs = form.getFieldValue('attrs')
        if (currentAttrs?.included_types) {
            setSelectedTypes(currentAttrs.included_types)
        }
    }, [form])

    const handleTypeChange = (checkedValues: any[]) => {
        setSelectedTypes(checkedValues)
        // Store selected types in attrs so backend knows what this combo is made of
        const currentAttrs = form.getFieldValue('attrs') || {}
        form.setFieldValue('attrs', {
            ...currentAttrs,
            included_types: checkedValues
        })
    }

    return (
        <div style={{ marginTop: 16 }}>
            <Form.Item
                label="组合包含内容"
                name={['attrs', 'included_types']}
                rules={[
                    {
                        validator: async (_, value) => {
                            if (!value || value.length < 2) {
                                return Promise.reject(new Error('组合资源至少需要包含两种类型的资源'))
                            }
                        }
                    }
                ]}
            >
                <Checkbox.Group options={SUB_TYPES} onChange={handleTypeChange} />
            </Form.Item>

            {selectedTypes.length > 0 && (
                <Alert
                    message="组合资源字段说明"
                    description="下方各个资源类型的字段是独立的。例如：酒店的联系电话与门票的联系电话互不影响，请分别填写。"
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {selectedTypes.includes('酒店') && (
                <div style={{ position: 'relative' }}>
                    <Divider orientation="left">🏨 酒店部分</Divider>
                    <HotelResourceFields prefix={['attrs', 'hotel']} />
                </div>
            )}

            {selectedTypes.includes('门票') && (
                <div style={{ position: 'relative' }}>
                    <Divider orientation="left">🎫 门票部分</Divider>
                    <TicketResourceFields prefix={['attrs', 'ticket']} />
                </div>
            )}

            {selectedTypes.includes('餐饮') && (
                <div style={{ position: 'relative' }}>
                    <Divider orientation="left">🍽️ 餐饮部分</Divider>
                    <DiningResourceFields prefix={['attrs', 'dining']} />
                </div>
            )}

            {selectedTypes.includes('交通') && (
                <div style={{ position: 'relative' }}>
                    <Divider orientation="left">🚗 交通部分</Divider>
                    <TransportResourceFields prefix={['attrs', 'transport']} />
                </div>
            )}
        </div>
    )
}
