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
    const text = await res.text()

    if (!res.ok) {
        let errMsg = `请求失败 (${res.status})`
        try {
            const parsed = JSON.parse(text)
            if (parsed?.detail) {
                if (typeof parsed.detail === 'string') {
                    errMsg = parsed.detail
                } else if (Array.isArray(parsed.detail)) {
                    errMsg = parsed.detail.map((d: any) => d?.msg || '').filter(Boolean).join('; ') || errMsg
                }
            }
        } catch {
            errMsg = text || errMsg
        }
        // 简单中英对照映射
        const map: Record<string, string> = {
            "POI name already exists": "POI 名称已存在",
            "Resource name already exists": "资源名称已存在",
            "Product name already exists": "产品名称已存在",
            "Supplier name already exists": "供应商名称已存在",
            "Channel name already exists": "渠道名称已存在",
            "SKU name already exists on this channel": "该渠道下已有同名 SKU",
            "SKU not found": "未找到 SKU",
            "Channel not found": "未找到渠道",
            "Product not found": "未找到产品",
            "Supplier not found": "未找到供应商",
            "Resource not found": "未找到资源",
            "POI not found": "未找到 POI",
            "Invalid date format, expected YYYY-MM-DD": "日期格式错误，应为 YYYY-MM-DD",
            "Inventory record not found": "未找到库存记录",
            "Channel creation failed": "创建渠道失败",
            "Update failed": "更新失败",
            "Channel creation failed, name might be duplicated": "创建渠道失败，可能是名称重复",
            "Price not found": "未找到价格",
            "Invalid token": "登录已过期，请重新登录",
            "Invalid or expired token": "登录已过期，请重新登录",
            "Missing credentials": "未登录，请先登录",
            "Incorrect username or password": "用户名或密码错误",
            "用户名或密码错误": "用户名或密码错误", // 确保后端返回中文时也能匹配（虽然本身就是中文）
        }
        if (map[errMsg]) errMsg = map[errMsg]
        // Removed forced 401 overwrite to allow backend details (like 'Wrong password') to show through
        throw new Error(errMsg)
    }

    if (res.status === 204 || text === '') {
        return {} as T
    }

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

// Axios-style API wrapper
export const api = {
    get: async <T = any>(path: string) => {
        const data = await apiRequest<T>(`/api${path}`)
        return { data }
    },
    post: async <T = any>(path: string, body?: any) => {
        const data = await apiRequest<T>(`/api${path}`, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined
        })
        return { data }
    },
    put: async <T = any>(path: string, body?: any) => {
        const data = await apiRequest<T>(`/api${path}`, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined
        })
        return { data }
    },
    delete: async <T = any>(path: string) => {
        const data = await apiRequest<T>(`/api${path}`, { method: 'DELETE' })
        return { data }
    }
}
