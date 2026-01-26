import { Button, Form, Input } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

interface ContactTableEditorProps {
    name: string | (string | number)[]
    showRemark?: boolean
    addLabel?: string
    emptyText?: string
}

export default function ContactTableEditor({
    name,
    showRemark = false,
    addLabel = '添加联系人',
    emptyText = '还没有联系人，点击下方按钮添加',
}: ContactTableEditorProps) {
    const gridTemplateColumns = showRemark
        ? '1.1fr 1.1fr 1.5fr 1fr 1.6fr 72px'
        : '1.2fr 1.2fr 1.6fr 1fr 72px'

    return (
        <Form.List name={name}>
            {(fields, { add, remove }) => (
                <div
                    style={{
                        border: '1px solid #e6e9f0',
                        borderRadius: 12,
                        padding: 12,
                        background: 'linear-gradient(180deg, #fbfcff 0%, #ffffff 100%)',
                    }}
                >
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns,
                            gap: 12,
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 10,
                            background: '#f2f5fb',
                            color: '#495066',
                            fontWeight: 600,
                            fontSize: 12,
                            letterSpacing: 0.4,
                        }}
                    >
                        <span>联系人</span>
                        <span>电话</span>
                        <span>邮箱</span>
                        <span>职位</span>
                        {showRemark && <span>备注</span>}
                        <span>操作</span>
                    </div>
                    {fields.length === 0 && (
                        <div style={{ padding: '12px 12px', color: '#9aa1b2', fontSize: 12 }}>
                            {emptyText}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                        {fields.map((field) => (
                            <div
                                key={field.key}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns,
                                    gap: 12,
                                    alignItems: 'center',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid #edf0f5',
                                    background: '#fff',
                                    boxShadow: '0 1px 0 rgba(15, 23, 42, 0.03)',
                                }}
                            >
                                <Form.Item name={[field.name, 'name']} style={{ marginBottom: 0 }}>
                                    <Input size="small" placeholder="姓名" />
                                </Form.Item>
                                <Form.Item name={[field.name, 'phone']} style={{ marginBottom: 0 }}>
                                    <Input size="small" placeholder="电话" />
                                </Form.Item>
                                <Form.Item name={[field.name, 'email']} style={{ marginBottom: 0 }}>
                                    <Input size="small" placeholder="邮箱" />
                                </Form.Item>
                                <Form.Item name={[field.name, 'position']} style={{ marginBottom: 0 }}>
                                    <Input size="small" placeholder="职位" />
                                </Form.Item>
                                {showRemark && (
                                    <Form.Item name={[field.name, 'remark']} style={{ marginBottom: 0 }}>
                                        <Input size="small" placeholder="备注" />
                                    </Form.Item>
                                )}
                                <Button type="text" danger onClick={() => remove(field.name)}>
                                    删除
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button
                        type="dashed"
                        onClick={() => add({})}
                        block
                        icon={<PlusOutlined />}
                        style={{ marginTop: 12 }}
                    >
                        {addLabel}
                    </Button>
                </div>
            )}
        </Form.List>
    )
}
