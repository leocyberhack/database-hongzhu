import type React from 'react'
import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { message } from 'antd'
import type { MockData } from '../types'
import { apiRequest } from '@/lib/api'
import { useAuth } from './AuthContext'

type MockDataKey = keyof MockData

interface DataContextValue {
    data: MockData
    loading: boolean
    loadData: (keys: MockDataKey[], options?: { force?: boolean }) => Promise<void>
    refresh: (keys?: MockDataKey[]) => Promise<void>
    updateData: <K extends MockDataKey>(key: K, value: MockData[K] | ((prev: MockData[K]) => MockData[K])) => void
}

const DataContext = createContext<DataContextValue>({
    data: {} as MockData,
    loading: false,
    loadData: async () => { },
    refresh: async () => { },
    updateData: () => { },
})

const emptyData: MockData = {
    poi: [],
    resources: [],
    suppliers: [],
    supplier_resources: [],
    supplier_resource_price_history: [],
    product_categories: [],
    products: [],
    product_resources: [],
    product_structure_snapshot: [],
    skus: [],
    channels: [],
    sku_channels: [],
    prices: [],
    price_history: [],
    inventory: [],
    inventory_log: [],
    orders: [],
    order_status_history: [],
    approvals: [],
    audit_log: [],
    spus: [],
}

const DEFAULT_PAGE_SIZE = 1000

const ENDPOINTS: Record<MockDataKey, string> = {
    poi: '/api/poi',
    resources: '/api/resources',
    suppliers: '/api/suppliers',
    supplier_resources: '/api/supplier-resources',
    supplier_resource_price_history: '/api/supplier-resource-price-history',
    product_categories: '/api/product-categories',
    products: '/api/products',
    product_resources: '/api/product-resources',
    product_structure_snapshot: '/api/product-snapshots',
    skus: '/api/skus',
    channels: '/api/channels',
    sku_channels: '/api/sku_channels',
    prices: '/api/prices',
    price_history: '/api/price-history',
    inventory: '/api/inventory',
    inventory_log: '/api/inventory/logs',
    orders: '/api/orders',
    order_status_history: '/api/order-status-history',
    approvals: '/api/approvals',
    audit_log: '/api/audit-log',
    spus: '/api/spus',
}

const ALL_KEYS = Object.keys(ENDPOINTS) as MockDataKey[]

function buildPagedUrl(base: string, page: number, pageSize: number) {
    const joiner = base.includes('?') ? '&' : '?'
    return `${base}${joiner}page=${page}&page_size=${pageSize}`
}

async function fetchAll<T>(endpoint: string): Promise<T[]> {
    let page = 1
    let items: T[] = []
    while (true) {
        const res = await apiRequest<{ items: T[]; pagination?: { total?: number } }>(
            buildPagedUrl(endpoint, page, DEFAULT_PAGE_SIZE)
        )
        const batch = res.items ?? []
        items = items.concat(batch)
        const total = res.pagination?.total
        if (total === undefined || total === null) {
            break
        }
        if (items.length >= total) {
            break
        }
        if (batch.length === 0) {
            break
        }
        page += 1
    }
    return items
}

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<MockData>(emptyData)
    const [loadingKeys, setLoadingKeys] = useState<Set<MockDataKey>>(new Set())
    const { token } = useAuth()
    const loadedKeysRef = useRef<Set<MockDataKey>>(new Set())

    const setLoadingFor = useCallback((keys: MockDataKey[], isLoading: boolean) => {
        setLoadingKeys((prev) => {
            const next = new Set(prev)
            keys.forEach((k) => {
                if (isLoading) {
                    next.add(k)
                } else {
                    next.delete(k)
                }
            })
            return next
        })
    }, [])

    const loadData = useCallback(async (keys: MockDataKey[], options?: { force?: boolean }) => {
        if (!token || keys.length === 0) return
        const force = options?.force ?? false
        const uniqueKeys = Array.from(new Set(keys))
        const targets = force ? uniqueKeys : uniqueKeys.filter((k) => !loadedKeysRef.current.has(k))
        if (targets.length === 0) return
        setLoadingFor(targets, true)
        try {
            const results = await Promise.all(
                targets.map(async (key) => {
                    const endpoint = ENDPOINTS[key]
                    const items = await fetchAll<any>(endpoint)
                    return [key, items] as const
                })
            )
            setData((prev) => {
                const next = { ...prev }
                results.forEach(([key, items]) => {
                    next[key] = items
                })
                return next
            })
            targets.forEach((key) => loadedKeysRef.current.add(key))
        } catch (err) {
            console.error(err)
            message.error('加载后端数据失败，请检查API服务或认证信息')
        } finally {
            setLoadingFor(targets, false)
        }
    }, [setLoadingFor, token])

    const refresh = useCallback(async (keys?: MockDataKey[]) => {
        const targets = keys && keys.length > 0 ? keys : ALL_KEYS
        await loadData(targets, { force: true })
    }, [loadData])

    useEffect(() => {
        if (!token) {
            setData(emptyData)
            loadedKeysRef.current = new Set()
            setLoadingKeys(new Set())
        }
    }, [token])

    const updateData = useCallback(<K extends MockDataKey>(key: K, value: MockData[K] | ((prev: MockData[K]) => MockData[K])) => {
        setData((prev) => {
            const nextSection = typeof value === 'function' ? (value as (prev: MockData[K]) => MockData[K])(prev[key]) : value
            return { ...prev, [key]: nextSection }
        })
    }, [])

    const ctx = useMemo(
        () => ({
            data,
            loading: loadingKeys.size > 0,
            loadData,
            refresh,
            updateData,
        }),
        [data, loadingKeys.size, loadData, refresh, updateData]
    )

    return <DataContext.Provider value={ctx}>{children}</DataContext.Provider>
}

export function useData() {
    return useContext(DataContext)
}
