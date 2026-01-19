import { useState } from 'react'
import { Form, Input, Button, Typography, message, ConfigProvider, theme } from 'antd'
import { UserOutlined, LockOutlined, ArrowRightOutlined, CheckCircleFilled } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'

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
        <ConfigProvider
            theme={{
                algorithm: theme.defaultAlgorithm,
                token: {
                    colorPrimary: '#f5222d',
                    colorBgContainer: '#ffffff',
                }
            }}
        >
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                background: '#f8fafc', // Light Grey/Blue
                backgroundImage: `
                    radial-gradient(circle at 15% 50%, rgba(245, 34, 45, 0.05), transparent 25%),
                    radial-gradient(circle at 85% 30%, rgba(22, 119, 255, 0.05), transparent 25%)
                `
            }}>
                {/* Animated Background Elements */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 180, 360],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    style={{
                        position: 'absolute',
                        top: '-20%',
                        right: '-10%',
                        width: '800px',
                        height: '800px',
                        borderRadius: '40%',
                        background: 'radial-gradient(circle, rgba(255, 77, 79, 0.1) 0%, transparent 70%)',
                        filter: 'blur(60px)',
                        zIndex: 0
                    }}
                />

                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    style={{ zIndex: 1, width: '100%', maxWidth: '440px', padding: '20px' }}
                >
                    <div className="glass-panel" style={{
                        padding: '56px 40px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.02)',
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '24px'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <motion.div
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                style={{
                                    width: '72px',
                                    height: '72px',
                                    background: 'linear-gradient(135deg, #ff4d4f, #f5222d)',
                                    borderRadius: '20px',
                                    margin: '0 auto 24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 10px 20px rgba(245, 34, 45, 0.2)',
                                    position: 'relative'
                                }}>
                                <span style={{ fontSize: '32px', color: '#fff' }}>🐷</span>
                            </motion.div>

                            <Title level={1} style={{ margin: '0 0 8px 0', fontSize: '30px', letterSpacing: '-0.5px', color: '#1f1f1f' }}>红猪数据库</Title>
                            <Text type="secondary" style={{ fontSize: '15px' }}>Access Control System</Text>
                        </div>

                        <Form
                            name="login"
                            initialValues={{ remember: true }}
                            onFinish={onFinish}
                            size="large"
                            layout="vertical"
                            requiredMark={false}
                        >
                            <Form.Item
                                name="username"
                                rules={[{ required: true, message: '请输入用户名！' }]}
                                style={{ marginBottom: '24px' }}
                            >
                                <Input
                                    prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                                    placeholder="用户名"
                                    style={{
                                        borderRadius: '12px',
                                        padding: '12px 16px',
                                        background: '#fff',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                                    }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="password"
                                rules={[{ required: true, message: '请输入密码！' }]}
                                style={{ marginBottom: '32px' }}
                            >
                                <Input.Password
                                    prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                                    placeholder="密码"
                                    style={{
                                        borderRadius: '12px',
                                        padding: '12px 16px',
                                        background: '#fff',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                                    }}
                                />
                            </Form.Item>

                            <Form.Item>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    loading={loading}
                                    style={{
                                        height: '52px',
                                        borderRadius: '14px',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '12px',
                                        background: 'linear-gradient(135deg, #ff4d4f 0%, #f5222d 100%)',
                                        border: 'none',
                                        boxShadow: '0 8px 20px rgba(245, 34, 45, 0.2)',
                                    }}
                                >
                                    立即登录 <ArrowRightOutlined />
                                </Button>
                            </Form.Item>

                            <div style={{ textAlign: 'center', marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                <CheckCircleFilled style={{ color: '#52c41a' }} />
                                <span>安全连接已加密</span>
                            </div>
                        </Form>
                    </div>
                </motion.div>
            </div>
        </ConfigProvider>
    )
}
