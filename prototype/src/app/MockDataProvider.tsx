import type React from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import type { MockData } from '../types'
import { useApprovalsStore } from '../store/approvals'
import { usePricesStore } from '../store/prices'
import { useInventoryStore } from '../store/inventory'
import { useOrdersStore } from '../store/orders'
import { useAuditLogStore } from '../store/auditLog'

type MockDataKey = keyof MockData

interface MockDataContextValue {
  data: MockData | null
  loading: boolean
  refresh: () => void
  updateData: <K extends MockDataKey>(key: K, value: MockData[K] | ((prev: MockData[K]) => MockData[K])) => void
}

const MockDataContext = createContext<MockDataContextValue>({
  data: null,
  loading: true,
  refresh: () => {},
  updateData: () => {},
})

const emptyData: MockData = {
  poi: [],
  resources: [],
  suppliers: [],
  supplier_resources: [],
  supplier_resource_price_history: [],
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

const mockFiles: Record<MockDataKey, string> = {
  poi: '/mock/poi.json',
  resources: '/mock/resources.json',
  suppliers: '/mock/suppliers.json',
  supplier_resources: '/mock/supplier_resources.json',
  supplier_resource_price_history: '/mock/supplier_resource_price_history.json',
  products: '/mock/products.json',
  product_resources: '/mock/product_resources.json',
  product_structure_snapshot: '/mock/product_structure_snapshot.json',
  skus: '/mock/skus.json',
  channels: '/mock/channels.json',
  sku_channels: '/mock/sku_channels.json',
  prices: '/mock/prices.json',
  price_history: '/mock/price_history.json',
  inventory: '/mock/inventory.json',
  inventory_log: '/mock/inventory_log.json',
  orders: '/mock/orders.json',
  order_status_history: '/mock/order_status_history.json',
  approvals: '/mock/approvals.json',
  audit_log: '/mock/audit_log.json',
}

export default function MockDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MockData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const hydrateStores = (payload: MockData) => {
    useApprovalsStore.getState().hydrate(payload.approvals)
    usePricesStore.getState().hydrate(payload.prices, payload.price_history)
    useInventoryStore.getState().hydrate(payload.inventory, payload.inventory_log)
    useOrdersStore.getState().hydrate(payload.orders, payload.order_status_history)
    useAuditLogStore.getState().hydrate(payload.audit_log)
  }

  const fetchMock = async () => {
    setLoading(true)
    try {
      const entries = await Promise.all(
        Object.entries(mockFiles).map(async ([key, path]) => {
          const res = await fetch(path)
          if (!res.ok) {
            throw new Error(`加载 ${path} 失败`)
          }
          const json = await res.json()
          return [key, json] as [string, unknown]
        }),
      )
      const next = { ...emptyData, ...Object.fromEntries(entries) } as MockData
      setData(next)
      hydrateStores(next)
    } catch (err) {
      console.error(err)
      message.error('加载 mock 数据失败，请检查 /public/mock 下的 json 文件')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateData = <K extends MockDataKey>(key: K, value: MockData[K] | ((prev: MockData[K]) => MockData[K])) => {
    setData((prev) => {
      if (!prev) return prev
      const nextSection = typeof value === 'function' ? (value as (prev: MockData[K]) => MockData[K])(prev[key]) : value
      const next = { ...prev, [key]: nextSection }
      return next
    })
  }

  const ctx = useMemo(
    () => ({
      data,
      loading,
      refresh: fetchMock,
      updateData,
    }),
    [data, loading],
  )

  return <MockDataContext.Provider value={ctx}>{children}</MockDataContext.Provider>
}

export function useMockDataContext() {
  return useContext(MockDataContext)
}
