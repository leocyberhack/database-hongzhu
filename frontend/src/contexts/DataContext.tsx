import type React from 'react'
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { message } from 'antd'
import type { MockData } from '../types'
import { apiRequest } from '@/lib/api'
import { useAuth } from './AuthContext'

type MockDataKey = keyof MockData

interface DataContextValue {
    data: MockData | null
    loading: boolean
    refresh: () => void
    updateData: <K extends MockDataKey>(key: K, value: MockData[K] | ((prev: MockData[K]) => MockData[K])) => void
}

const DataContext = createContext<DataContextValue>({
    data: null,
    loading: true,
    refresh: () => { },
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
    const [data, setData] = useState<MockData | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const { token } = useAuth()

    const fetchBackend = useCallback(async () => {
        setLoading(true)
        try {
            const [
                poiRes,
                resRes,
                supRes,
                supLinkRes,
                supPriceHistRes,
                prodRes,
                prodLinkRes,
                prodSnapRes,
                skuRes,
                channelRes,
                skuChannelRes,
                priceRes,
                priceHistRes,
                invRes,
                invLogRes,
                orderRes,
                orderHistRes,
                approvalRes,
                auditRes,
                prodCatRes,
                spuRes,
            ] = await Promise.all([
                fetchAll<MockData['poi'][number]>(`/api/poi`),
                fetchAll<MockData['resources'][number]>(`/api/resources`),
                fetchAll<MockData['suppliers'][number]>(`/api/suppliers`),
                fetchAll<MockData['supplier_resources'][number]>(`/api/supplier-resources`),
                fetchAll<MockData['supplier_resource_price_history'][number]>(`/api/supplier-resource-price-history`),
                fetchAll<MockData['products'][number]>(`/api/products`),
                fetchAll<MockData['product_resources'][number]>(`/api/product-resources`),
                fetchAll<MockData['product_structure_snapshot'][number]>(`/api/product-snapshots`),
                fetchAll<MockData['skus'][number]>(`/api/skus`),
                fetchAll<MockData['channels'][number]>(`/api/channels`),
                fetchAll<MockData['sku_channels'][number]>(`/api/sku_channels`).catch(() => []),
                fetchAll<MockData['prices'][number]>(`/api/prices`),
                fetchAll<MockData['price_history'][number]>(`/api/price-history`),
                fetchAll<MockData['inventory'][number]>(`/api/inventory`),
                fetchAll<MockData['inventory_log'][number]>(`/api/inventory/logs`),
                fetchAll<MockData['orders'][number]>(`/api/orders`),
                fetchAll<MockData['order_status_history'][number]>(`/api/order-status-history`).catch(() => []),
                fetchAll<MockData['approvals'][number]>(`/api/approvals`),
                fetchAll<MockData['audit_log'][number]>(`/api/audit-log`),
                fetchAll<MockData['product_categories'][number]>(`/api/product-categories`),
                fetchAll<MockData['spus'][number]>(`/api/spus`),
            ])

            const next: MockData = {
                ...emptyData,
                poi: poiRes,
                resources: resRes,
                suppliers: supRes,
                supplier_resources: supLinkRes,
                supplier_resource_price_history: supPriceHistRes,
                product_categories: prodCatRes,
                products: prodRes,
                product_resources: prodLinkRes,
                product_structure_snapshot: prodSnapRes,
                skus: skuRes,
                channels: channelRes,
                sku_channels: skuChannelRes ?? [],
                prices: priceRes,
                price_history: priceHistRes,
                inventory: invRes,
                inventory_log: invLogRes,
                orders: orderRes,
                order_status_history: orderHistRes ?? [],
                approvals: approvalRes,
                audit_log: auditRes,
                spus: spuRes,
            }
            setData(next)
        } catch (err) {
            console.error(err)
            message.error('加载后端数据失败，请检查API服务或认证信息')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!token) {
            setData(null)
            setLoading(false)
            return
        }
        fetchBackend()
    }, [token, fetchBackend])

    const updateData = useCallback(<K extends MockDataKey>(key: K, value: MockData[K] | ((prev: MockData[K]) => MockData[K])) => {
        setData((prev) => {
            if (!prev) return prev
            const nextSection = typeof value === 'function' ? (value as (prev: MockData[K]) => MockData[K])(prev[key]) : value
            return { ...prev, [key]: nextSection }
        })
    }, [])

    const ctx = useMemo(
        () => ({
            data,
            loading,
            refresh: token ? fetchBackend : () => setLoading(false),
            updateData,
        }),
        [data, loading, token, fetchBackend, updateData]
    )

    return <DataContext.Provider value={ctx}>{children}</DataContext.Provider>
}

export function useData() {
    return useContext(DataContext)
}
