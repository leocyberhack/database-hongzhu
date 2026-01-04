import type React from 'react'
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { apiRequest, storeAuth, clearAuth, getAuthUser, getToken } from '../lib/api'

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
        if (storedUser && storedToken) {
            setUser(storedUser)
            setToken(storedToken)
        }
        setLoading(false)
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
