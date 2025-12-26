import { create } from 'zustand'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import type { Inventory, InventoryLog } from '../types'

interface InventoryState {
  inventory: Inventory[]
  inventoryLog: InventoryLog[]
  hydrate: (items: Inventory[], logs: InventoryLog[]) => void
  hasFutureStock: (skuId: string, days?: number) => boolean
  initInventory: (skuId: string, dates: string[], total: number, operator: string, reason?: string) => void
  freeze: (skuId: string, inventoryDate: string, quantity: number, orderId: string, operator: string) => { ok: boolean; message?: string }
  consume: (skuId: string, inventoryDate: string, quantity: number, orderId: string, operator: string) => { ok: boolean; message?: string }
  release: (skuId: string, inventoryDate: string, quantity: number, orderId: string, operator: string) => { ok: boolean; message?: string }
  adjust: (skuId: string, inventoryDate: string, total: number, operator: string, remark?: string) => void
}

const buildLog = (
  sku_id: string,
  inventory_date: string,
  change_type: string,
  before_qty: { total: number; frozen: number; sold: number },
  after_qty: { total: number; frozen: number; sold: number },
  operator: string,
  related_order_id?: string,
  remark?: string,
): InventoryLog => ({
  id: nanoid(8),
  sku_id,
  inventory_date,
  change_type,
  before_qty,
  after_qty,
  operator,
  operated_at: dayjs().toISOString(),
  related_order_id,
  remark,
})

export const useInventoryStore = create<InventoryState>((set, get) => ({
  inventory: [],
  inventoryLog: [],
  hydrate: (items, logs) => set({ inventory: items, inventoryLog: logs }),
  hasFutureStock: (skuId, days = 7) => {
    const now = dayjs()
    const end = now.add(days, 'day')
    return get().inventory.some((item) => {
      const date = dayjs(item.inventory_date)
      const available = item.total_qty - item.frozen_qty - item.sold_qty
      return item.sku_id === skuId && date.isAfter(now.subtract(1, 'day')) && date.isBefore(end) && available > 0
    })
  },
  initInventory: (skuId, dates, total, operator, reason) =>
    set((state) => {
      const nextInventory = [...state.inventory]
      const nextLogs: InventoryLog[] = [...state.inventoryLog]
      dates.forEach((date) => {
        const existing = nextInventory.find((i) => i.sku_id === skuId && i.inventory_date === date)
        if (existing) {
          const before = { total: existing.total_qty, frozen: existing.frozen_qty, sold: existing.sold_qty }
          existing.total_qty = total
          const after = { total: existing.total_qty, frozen: existing.frozen_qty, sold: existing.sold_qty }
          nextLogs.unshift(buildLog(skuId, date, '初始化/调整', before, after, operator, undefined, reason))
        } else {
          const record: Inventory = {
            id: nanoid(8),
            sku_id: skuId,
            inventory_date: date,
            total_qty: total,
            frozen_qty: 0,
            sold_qty: 0,
            status: '正常',
          }
          nextInventory.push(record)
          nextLogs.unshift(
            buildLog(skuId, date, '初始化', { total: 0, frozen: 0, sold: 0 }, { total, frozen: 0, sold: 0 }, operator, undefined, reason),
          )
        }
      })
      return { inventory: nextInventory, inventoryLog: nextLogs }
    }),
  freeze: (skuId, inventoryDate, quantity, orderId, operator) => {
    const record = get().inventory.find((i) => i.sku_id === skuId && i.inventory_date === inventoryDate)
    if (!record) return { ok: false, message: '该日期未初始化库存' }
    const available = record.total_qty - record.frozen_qty - record.sold_qty
    if (available < quantity) return { ok: false, message: '库存不足，无法冻结' }
    const before = { total: record.total_qty, frozen: record.frozen_qty, sold: record.sold_qty }
    record.frozen_qty += quantity
    const after = { total: record.total_qty, frozen: record.frozen_qty, sold: record.sold_qty }
    set((state) => ({
      inventory: state.inventory.map((i) => (i.id === record.id ? record : i)),
      inventoryLog: [buildLog(skuId, inventoryDate, '冻结', before, after, operator, orderId), ...state.inventoryLog],
    }))
    return { ok: true }
  },
  consume: (skuId, inventoryDate, quantity, orderId, operator) => {
    const record = get().inventory.find((i) => i.sku_id === skuId && i.inventory_date === inventoryDate)
    if (!record) return { ok: false, message: '未找到库存记录' }
    if (record.frozen_qty < quantity) return { ok: false, message: '冻结库存不足' }
    const before = { total: record.total_qty, frozen: record.frozen_qty, sold: record.sold_qty }
    record.frozen_qty -= quantity
    record.sold_qty += quantity
    const after = { total: record.total_qty, frozen: record.frozen_qty, sold: record.sold_qty }
    set((state) => ({
      inventory: state.inventory.map((i) => (i.id === record.id ? record : i)),
      inventoryLog: [buildLog(skuId, inventoryDate, '核销', before, after, operator, orderId), ...state.inventoryLog],
    }))
    return { ok: true }
  },
  release: (skuId, inventoryDate, quantity, orderId, operator) => {
    const record = get().inventory.find((i) => i.sku_id === skuId && i.inventory_date === inventoryDate)
    if (!record) return { ok: false, message: '未找到库存记录' }
    if (record.frozen_qty < quantity) return { ok: false, message: '冻结库存不足' }
    const before = { total: record.total_qty, frozen: record.frozen_qty, sold: record.sold_qty }
    record.frozen_qty -= quantity
    const after = { total: record.total_qty, frozen: record.frozen_qty, sold: record.sold_qty }
    set((state) => ({
      inventory: state.inventory.map((i) => (i.id === record.id ? record : i)),
      inventoryLog: [buildLog(skuId, inventoryDate, '解冻', before, after, operator, orderId), ...state.inventoryLog],
    }))
    return { ok: true }
  },
  adjust: (skuId, inventoryDate, total, operator, remark) =>
    set((state) => {
      const record = state.inventory.find((i) => i.sku_id === skuId && i.inventory_date === inventoryDate)
      if (!record) return state
      const before = { total: record.total_qty, frozen: record.frozen_qty, sold: record.sold_qty }
      record.total_qty = total
      const after = { total: record.total_qty, frozen: record.frozen_qty, sold: record.sold_qty }
      return {
        inventory: state.inventory.map((i) => (i.id === record.id ? record : i)),
        inventoryLog: [buildLog(skuId, inventoryDate, '人工调整', before, after, operator, undefined, remark), ...state.inventoryLog],
      }
    }),
}))
