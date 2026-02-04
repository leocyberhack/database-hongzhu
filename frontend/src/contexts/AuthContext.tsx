import type React from 'react'
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { apiRequest, storeAuth, clearAuth, getAuthUser, getToken } from '@/lib/api'

interface User {
    username: string
    role: string
}

interface AuthContextValue {
    user: User | null
    token: string | null
    login: (username: string, password: string) => Promise<void>
    logout: () => void
    loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    token: null,
    login: async () => { },
    logout: () => { },
    loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const storedUser = getAuthUser()
        const storedToken = getToken()

        // getStoredAuth() 内部已经检查过期了，如果过期会自动清除
        // 这里再次检查确保同步
        if (storedUser && storedToken) {
            setUser(storedUser)
            setToken(storedToken)
        } else {
            // 如果存储被清除（可能是24小时过期），确保状态也清除
            setUser(null)
            setToken(null)
        }
        setLoading(false)

        // 设置定期检查（每分钟检查一次是否过期）
        const checkInterval = setInterval(() => {
            const currentUser = getAuthUser()
            const currentToken = getToken()

            // 如果 getAuthUser/getToken 返回 null，说明已过期被自动清除
            if (!currentUser || !currentToken) {
                setUser(null)
                setToken(null)
            }
        }, 60000) // 每60秒检查一次

        return () => clearInterval(checkInterval)
    }, [])

    useEffect(() => {
        const handleExpired = () => {
            clearAuth()
            setUser(null)
            setToken(null)
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('auth:expired', handleExpired)
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('auth:expired', handleExpired)
            }
        }
    }, [])

    const login = useCallback(async (username: string, password: string) => {
        const res = await apiRequest<{ access_token: string; user: User }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        })
        storeAuth(res.access_token, res.user)
        setUser(res.user)
        setToken(res.access_token)
    }, [])

    const logout = useCallback(() => {
        clearAuth()
        setUser(null)
        setToken(null)
    }, [])

    const value = useMemo(
        () => ({ user, token, login, logout, loading }),
        [user, token, login, logout, loading]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    return useContext(AuthContext)
}
