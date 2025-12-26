import dayjs from 'dayjs'
import type { Order, Inventory, AuditLog } from '../types'

export interface MetricRow {
  key: string
  gmv: number
  profit: number
  orders: number
  verified: number
  refunded: number
}

export const aggregateByDate = (orders: Order[], grain: 'day' | 'week' | 'month') => {
  const map = new Map<string, MetricRow>()
  orders.forEach((order) => {
    const bucket = dayjs(order.created_at || order.travel_date).startOf(grain).format('YYYY-MM-DD')
    if (!map.has(bucket)) {
      map.set(bucket, { key: bucket, gmv: 0, profit: 0, orders: 0, verified: 0, refunded: 0 })
    }
    const row = map.get(bucket)!
    row.orders += 1
    row.gmv += order.sale_amount
    row.profit += order.profit_amount || 0
    if (order.status === '已核销') row.verified += 1
    if (order.status === '已退款') row.refunded += 1
  })
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
}

export const aggregateTop = (orders: Order[], dimension: 'channel_id' | 'sku_id' | 'product_id') => {
  const map = new Map<string, MetricRow>()
  orders.forEach((order) => {
    const key = (order as any)[dimension] as string
    if (!map.has(key)) {
      map.set(key, { key, gmv: 0, profit: 0, orders: 0, verified: 0, refunded: 0 })
    }
    const row = map.get(key)!
    row.orders += 1
    row.gmv += order.sale_amount
    row.profit += order.profit_amount || 0
    if (order.status === '已核销') row.verified += 1
    if (order.status === '已退款') row.refunded += 1
  })
  return Array.from(map.values()).sort((a, b) => b.gmv - a.gmv).slice(0, 5)
}

export const countStockAlerts = (inventory: Inventory[]) => {
  const today = dayjs()
  const soon = today.add(7, 'day')
  return inventory.filter((item) => {
    const date = dayjs(item.inventory_date)
    const left = item.total_qty - item.frozen_qty - item.sold_qty
    return date.isAfter(today.subtract(1, 'day')) && date.isBefore(soon) && left <= 0
  }).length
}

export const countAuditByTable = (logs: AuditLog[]) => {
  const map = new Map<string, number>()
  logs.forEach((log) => {
    map.set(log.table_name, (map.get(log.table_name) ?? 0) + 1)
  })
  return Array.from(map.entries()).map(([table, count]) => ({ table, count }))
}
