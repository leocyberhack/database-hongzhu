// API client for backend communication
const API_BASE_RAW = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://127.0.0.1:8000'
const API_BASE = API_BASE_RAW.trim().replace(/\/$/, '') || 'http://127.0.0.1:8000'
const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

function getStoredAuth() {
    const token = localStorage.getItem(TOKEN_KEY) || undefined
    const user = localStorage.getItem(USER_KEY)
    let role: string | undefined
    if (user) {
        try {
            const parsed = JSON.parse(user) as { role?: string }
            role = parsed.role
        } catch {
            role = undefined
        }
    }
    return { token, role }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!API_BASE) throw new Error('API base is not configured')
    const { token, role } = getStoredAuth()
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(role ? { 'X-Role': role } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`API ${path} failed: ${res.status} ${text}`)
    }
    if (res.status === 204) {
        return {} as T
    }
    const text = await res.text()
    if (!text) return {} as T
    try {
        return JSON.parse(text)
    } catch {
        // Fallback for non-JSON response if any
        return text as unknown as T
    }
}

export function storeAuth(token: string, user: { username: string; role: string }) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
}

export function getAuthUser() {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw) as { username: string; role: string }
    } catch {
        return null
    }
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY)
}
