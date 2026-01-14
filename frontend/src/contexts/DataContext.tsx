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
}

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<MockData | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const { token } = useAuth()

    const fetchBackend = useCallback(async () => {
        setLoading(true)
        try {
            const qs = '?page=1&page_size=1000'
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
            ] = await Promise.all([
                apiRequest<{ items: MockData['poi'] }>(`/api/poi${qs}`),
                apiRequest<{ items: MockData['resources'] }>(`/api/resources${qs}`),
                apiRequest<{ items: MockData['suppliers'] }>(`/api/suppliers${qs}`),
                apiRequest<{ items: MockData['supplier_resources'] }>(`/api/supplier-resources${qs}`),
                apiRequest<{ items: MockData['supplier_resource_price_history'] }>(`/api/supplier-resource-price-history${qs}`),
                apiRequest<{ items: MockData['products'] }>(`/api/products${qs}`),
                apiRequest<{ items: MockData['product_resources'] }>(`/api/product-resources${qs}`),
                apiRequest<{ items: MockData['product_structure_snapshot'] }>(`/api/product-snapshots${qs}`),
                apiRequest<{ items: MockData['skus'] }>(`/api/skus${qs}`),
                apiRequest<{ items: MockData['channels'] }>(`/api/channels${qs}`),
                apiRequest<{ items: MockData['sku_channels'] }>(`/api/sku_channels${qs}`).catch(() => ({ items: [] })),
                apiRequest<{ items: MockData['prices'] }>(`/api/prices${qs}`),
                apiRequest<{ items: MockData['price_history'] }>(`/api/price-history${qs}`),
                apiRequest<{ items: MockData['inventory'] }>(`/api/inventory${qs}`),
                apiRequest<{ items: MockData['inventory_log'] }>(`/api/inventory/logs${qs}`),
                apiRequest<{ items: MockData['orders'] }>(`/api/orders${qs}`),
                apiRequest<{ items: MockData['order_status_history'] }>(`/api/order-status-history${qs}`).catch(() => ({ items: [] })),
                apiRequest<{ items: MockData['approvals'] }>(`/api/approvals${qs}`),
                apiRequest<{ items: MockData['audit_log'] }>(`/api/audit-log${qs}`),
                apiRequest<{ items: MockData['product_categories'] }>(`/api/product-categories${qs}`),
            ])

            const next: MockData = {
                ...emptyData,
                poi: poiRes.items,
                resources: resRes.items,
                suppliers: supRes.items,
                supplier_resources: supLinkRes.items,
                supplier_resource_price_history: supPriceHistRes.items,
                product_categories: prodCatRes.items,
                products: prodRes.items,
                product_resources: prodLinkRes.items,
                product_structure_snapshot: prodSnapRes.items,
                skus: skuRes.items,
                channels: channelRes.items,
                sku_channels: skuChannelRes.items ?? [],
                prices: priceRes.items,
                price_history: priceHistRes.items,
                inventory: invRes.items,
                inventory_log: invLogRes.items,
                orders: orderRes.items,
                order_status_history: orderHistRes.items ?? [],
                approvals: approvalRes.items,
                audit_log: auditRes.items,
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
