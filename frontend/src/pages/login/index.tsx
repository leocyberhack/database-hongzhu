import { useState } from 'react'
import { Form, Input, Button, Typography, message, ConfigProvider, theme } from 'antd'
import { UserOutlined, LockOutlined, ArrowRightOutlined, CheckCircleFilled, RocketOutlined } from '@ant-design/icons'
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
            message.success('登录成功，欢迎回来！')
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
                background: '#f8fafc',
            }}>
                {/* Intensified Background for Login Page - Matching Global Tone but Stronger */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                        radial-gradient(circle at 10% 20%, rgba(255, 80, 80, 0.5) 0%, transparent 60%),
                        radial-gradient(circle at 90% 80%, rgba(80, 160, 255, 0.5) 0%, transparent 60%),
                        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.8), transparent 100%)
                    `,
                    backgroundSize: '200% 200%',
                    animation: 'bg-pulse 4s ease-in-out infinite alternate',
                    zIndex: 0
                }} />
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes bg-pulse {
                        0% { background-position: 0% 0%; filter: hue-rotate(0deg); }
                        100% { background-position: 100% 100%; filter: hue-rotate(10deg); }
                    }
                `}} />

                {/* Floating Particles - Faster */}
                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={i}
                        animate={{
                            y: [0, -60, 0],
                            x: [0, Math.random() * 50 - 25, 0],
                            rotate: [0, 360],
                            scale: [1, 1.3, 1]
                        }}
                        transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, ease: "easeInOut" }}
                        style={{
                            position: 'absolute',
                            top: `${10 + Math.random() * 80}%`,
                            left: `${10 + Math.random() * 80}%`,
                            width: `${30 + Math.random() * 60}px`,
                            height: `${30 + Math.random() * 60}px`,
                            background: i % 2 === 0 ? 'rgba(245, 34, 45, 0.15)' : 'rgba(22, 119, 255, 0.15)',
                            borderRadius: '50%',
                            filter: 'blur(15px)',
                            zIndex: 0
                        }}
                    />
                ))}

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", duration: 0.6 }}
                    style={{ zIndex: 1, width: '100%', maxWidth: '420px', padding: '20px' }}
                >
                    <div className="glass-card" style={{
                        padding: '48px 40px',
                        background: 'rgba(255, 255, 255, 0.8)', // Slightly more opaque for contrast
                        backdropFilter: 'blur(30px)',
                        borderRadius: '32px',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.5)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <motion.div
                                animate={{ y: [0, -12, 0], boxShadow: ["0 10px 25px rgba(245,34,45,0.3)", "0 20px 40px rgba(245,34,45,0.5)", "0 10px 25px rgba(245,34,45,0.3)"] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                style={{
                                    width: '80px',
                                    height: '80px',
                                    background: 'linear-gradient(135deg, #f5222d, #ff7875)',
                                    borderRadius: '24px',
                                    margin: '0 auto 24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 10px 25px rgba(245, 34, 45, 0.3)',
                                    position: 'relative',
                                    transform: 'rotate(-5deg)'
                                }}
                            >
                                <RocketOutlined style={{ fontSize: '36px', color: 'white' }} />
                                {/* Halo */}
                                <div style={{ position: 'absolute', inset: -10, border: '2px solid rgba(245,34,45,0.1)', borderRadius: '30px' }} />
                            </motion.div>

                            <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 800, fontSize: '28px' }}>欢迎回来</Title>
                            <Text type="secondary" style={{ fontSize: '15px' }}>请输入您的红猪数据库账号</Text>
                        </div>

                        <Form
                            name="login"
                            initialValues={{ remember: true }}
                            onFinish={onFinish}
                            size="large"
                            layout="vertical"
                            requiredMark={false}
                        >
                            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                                <Form.Item
                                    name="username"
                                    rules={[{ required: true, message: '请输入用户名！' }]}
                                    style={{ marginBottom: '20px' }}
                                >
                                    <Input
                                        prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                                        placeholder="用户名 / Username"
                                        style={{ borderRadius: '12px', padding: '12px', background: 'rgba(255,255,255,0.8)', border: '1px solid #e2e8f0' }}
                                    />
                                </Form.Item>
                            </motion.div>

                            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                                <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: '请输入密码！' }]}
                                    style={{ marginBottom: '32px' }}
                                >
                                    <Input.Password
                                        prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                                        placeholder="密码 / Password"
                                        style={{ borderRadius: '12px', padding: '12px', background: 'rgba(255,255,255,0.8)', border: '1px solid #e2e8f0' }}
                                    />
                                </Form.Item>
                            </motion.div>

                            <Form.Item>
                                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        block
                                        loading={loading}
                                        style={{
                                            height: '52px',
                                            borderRadius: '16px',
                                            fontSize: '18px',
                                            fontWeight: 600,
                                            boxShadow: '0 8px 25px rgba(245, 34, 45, 0.3)',
                                            background: 'linear-gradient(90deg, #f5222d, #ff4d4f)',
                                            border: 'none'
                                        }}
                                    >
                                        立即登录 <ArrowRightOutlined />
                                    </Button>
                                </motion.div>
                            </Form.Item>

                            <div style={{ textAlign: 'center', marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                <CheckCircleFilled style={{ color: '#52c41a' }} />
                                <span>已启用 SSL 安全加密连接</span>
                            </div>
                        </Form>
                    </div>
                </motion.div>
            </div>
        </ConfigProvider>
    )
}
