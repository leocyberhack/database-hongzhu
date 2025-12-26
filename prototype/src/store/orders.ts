import { create } from 'zustand'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import type { Order, OrderStatusHistory } from '../types'

interface OrdersState {
  orders: Order[]
  statusHistory: OrderStatusHistory[]
  hydrate: (orders: Order[], history: OrderStatusHistory[]) => void
  createOrder: (payload: Omit<Order, 'id' | 'status' | 'created_at' | 'sale_amount' | 'cost_amount' | 'profit_amount'> & { id?: string }) => Order
  verifyOrder: (orderId: string, operator: string) => void
  refundOrder: (orderId: string, operator: string) => void
  importOrders: (orders: Order[]) => { added: number; skipped: number }
}

const calcAmounts = (salePrice: number, costPrice: number | null, quantity: number) => {
  const sale_amount = salePrice * quantity
  const cost_amount = costPrice != null ? costPrice * quantity : null
  const profit_amount = cost_amount != null ? sale_amount - cost_amount : null
  return { sale_amount, cost_amount, profit_amount }
}

export const useOrdersStore = create<OrdersState>((set, _get) => ({
  orders: [],
  statusHistory: [],
  hydrate: (orders, history) => set({ orders, statusHistory: history }),
  createOrder: (payload) => {
    const { sale_amount, cost_amount, profit_amount } = calcAmounts(payload.sale_price, payload.cost_price, payload.quantity)
    const order: Order = {
      ...payload,
      id: payload.id ?? nanoid(8),
      status: '已支付',
      sale_amount,
      cost_amount,
      profit_amount,
      created_at: dayjs().toISOString(),
    }
    const history: OrderStatusHistory = {
      id: nanoid(8),
      order_id: order.id,
      before_status: '创建',
      after_status: '已支付',
      operated_at: order.created_at,
    }
    set((state) => ({
      orders: [order, ...state.orders],
      statusHistory: [history, ...state.statusHistory],
    }))
    return order
  },
  verifyOrder: (orderId, operator) =>
    set((state) => {
      const target = state.orders.find((o) => o.id === orderId)
      if (!target) return state
      const updated: Order = { ...target, status: '已核销', verified_at: dayjs().toISOString() }
      const history: OrderStatusHistory = {
        id: nanoid(8),
        order_id: orderId,
        before_status: target.status,
        after_status: '已核销',
        operator,
        operated_at: updated.verified_at!,
      }
      return {
        orders: state.orders.map((o) => (o.id === orderId ? updated : o)),
        statusHistory: [history, ...state.statusHistory],
      }
    }),
  refundOrder: (orderId, operator) =>
    set((state) => {
      const target = state.orders.find((o) => o.id === orderId)
      if (!target) return state
      const updated: Order = { ...target, status: '已退款', refunded_at: dayjs().toISOString() }
      const history: OrderStatusHistory = {
        id: nanoid(8),
        order_id: orderId,
        before_status: target.status,
        after_status: '已退款',
        operator,
        operated_at: updated.refunded_at!,
      }
      return {
        orders: state.orders.map((o) => (o.id === orderId ? updated : o)),
        statusHistory: [history, ...state.statusHistory],
      }
    }),
  importOrders: (orders) => {
    let added = 0
    let skipped = 0
    set((state) => {
      const existingKey = new Set(state.orders.map((o) => `${o.order_no}::${o.channel_id}`))
      const incoming: Order[] = []
      orders.forEach((o) => {
        const key = `${o.order_no}::${o.channel_id}`
        if (existingKey.has(key)) {
          skipped += 1
          return
        }
        added += 1
        incoming.push(o)
        existingKey.add(key)
      })
      return { orders: [...incoming, ...state.orders] }
    })
    return { added, skipped }
  },
}))
