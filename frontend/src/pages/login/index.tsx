import { useState } from 'react'
import { Form, Input, Button, Typography, message } from 'antd'
import { UserOutlined, LockOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { CheckCircleFilled } from '@ant-design/icons'

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
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Animated Background Elements */}
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 90, 0],
                    opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-5%',
                    width: '600px',
                    height: '600px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 77, 79, 0.2) 0%, rgba(255, 255, 255, 0) 70%)',
                    filter: 'blur(40px)',
                    zIndex: 0
                }}
            />
            <motion.div
                animate={{
                    scale: [1, 1.3, 1],
                    x: [0, -50, 0],
                    opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                style={{
                    position: 'absolute',
                    bottom: '-10%',
                    left: '-10%',
                    width: '700px',
                    height: '700px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(114, 46, 209, 0.15) 0%, rgba(255, 255, 255, 0) 70%)',
                    filter: 'blur(50px)',
                    zIndex: 0
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ zIndex: 1, width: '100%', maxWidth: '440px', padding: '20px' }}
            >
                <div className="glass-panel" style={{
                    padding: '56px 40px',
                    boxShadow: '0 25px 80px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.5)',
                    background: 'rgba(255, 255, 255, 0.65)',
                    backdropFilter: 'blur(20px)'
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
                                boxShadow: '0 12px 24px rgba(245, 34, 45, 0.35)',
                                position: 'relative'
                            }}>
                            <span style={{ fontSize: '32px', color: '#fff' }}>🐷</span>

                            {/* Glow effect */}
                            <div style={{
                                position: 'absolute',
                                inset: -4,
                                borderRadius: '24px',
                                background: 'linear-gradient(135deg, #ff4d4f, #f5222d)',
                                zIndex: -1,
                                opacity: 0.4,
                                filter: 'blur(10px)'
                            }} />
                        </motion.div>

                        <Title level={1} style={{ margin: '0 0 8px 0', fontSize: '32px', letterSpacing: '-1px' }}>红猪数据库</Title>
                        <Text type="secondary" style={{ fontSize: '16px' }}>管理您的资源，掌控全局</Text>
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
                                    background: 'rgba(255,255,255,0.6)',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                    boxShadow: 'none'
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
                                    background: 'rgba(255,255,255,0.6)',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                    boxShadow: 'none'
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
                                    fontSize: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    boxShadow: '0 8px 20px rgba(245, 34, 45, 0.4)'
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
    )
}
