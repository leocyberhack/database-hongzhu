import { useState } from 'react'
import { Form, Input, Button, Typography, message } from 'antd'
import { UserOutlined, LockOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

const { Title, Text } = Typography

export default function LoginPage() {
    const [loading, setLoading] = useState(false)
    const { login } = useAuth()
    const navigate = useNavigate()

    const onFinish = async (values: any) => {
        setLoading(true)
        try {
            await login(values.username, values.password)
            message.success('登录成功')
            navigate('/dashboard')
        } catch (err) {
            console.error(err)
            message.error('登录失败，请检查用户名或密码')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 10% 20%, rgb(255, 241, 240) 0%, rgb(255, 255, 255) 90%)'
        }}>
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                zIndex: 0
            }}>
                {/* Animated background circles */}
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-5%',
                    width: '500px',
                    height: '500px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(255, 77, 79, 0.1), rgba(255, 255, 255, 0))',
                    filter: 'blur(60px)'
                }} />
                <div style={{
                    position: 'absolute',
                    bottom: '-10%',
                    left: '-10%',
                    width: '600px',
                    height: '600px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(64, 169, 255, 0.1), rgba(255, 255, 255, 0))',
                    filter: 'blur(80px)'
                }} />
            </div>

            <div style={{ zIndex: 1, width: '100%', maxWidth: '420px', padding: '20px' }}>
                <div className="glass-panel" style={{ padding: '48px 32px', boxShadow: '0 20px 50px rgba(0,0,0,0.08)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: 'linear-gradient(135deg, #ff4d4f, #f5222d)',
                            borderRadius: '16px',
                            margin: '0 auto 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 20px rgba(245, 34, 45, 0.3)'
                        }}>
                            <span style={{ fontSize: '24px', color: '#fff' }}>🐷</span>
                        </div>
                        <Title level={2} style={{ margin: 0, fontFamily: 'Outfit' }}>欢迎回来</Title>
                        <Text type="secondary" style={{ fontSize: '16px' }}>登录红猪数据库系统</Text>
                    </div>

                    <Form
                        name="login"
                        initialValues={{ remember: true }}
                        onFinish={onFinish}
                        size="large"
                        layout="vertical"
                    >
                        <Form.Item
                            name="username"
                            rules={[{ required: true, message: '请输入用户名！' }]}
                        >
                            <Input
                                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="用户名 (例如: manager)"
                                style={{ borderRadius: '8px', padding: '10px 16px' }}
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[{ required: true, message: '请输入密码！' }]}
                        >
                            <Input.Password
                                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                                placeholder="密码"
                                style={{ borderRadius: '8px', padding: '10px 16px' }}
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                style={{
                                    height: '48px',
                                    borderRadius: '12px',
                                    fontSize: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                登录 <ArrowRightOutlined />
                            </Button>
                        </Form.Item>

                        <div style={{ textAlign: 'center', marginTop: '24px' }}>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                内部系统 • 仅授权人员使用
                            </Text>
                        </div>
                    </Form>
                </div>
            </div>
        </div>
    )
}
