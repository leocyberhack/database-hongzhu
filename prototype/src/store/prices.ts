import { create } from 'zustand'
import dayjs from 'dayjs'
import { nanoid } from 'nanoid'
import type { Price, PriceHistory } from '../types'

interface PricesState {
  prices: Price[]
  priceHistory: PriceHistory[]
  hydrate: (prices: Price[], history: PriceHistory[]) => void
  checkConflict: (skuId: string, channelId: string, startAt: string, endAt: string, excludeId?: string) => Price[]
  upsertPrice: (price: Price) => void
  activatePrice: (priceId: string) => void
  cloneActiveToDraft: (skuId: string, channelId: string) => Price | null
  addHistory: (history: Omit<PriceHistory, 'id' | 'operated_at'> & { operated_at?: string }) => void
}

const overlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
  const startA = dayjs(aStart)
  const endA = dayjs(aEnd)
  const startB = dayjs(bStart)
  const endB = dayjs(bEnd)
  return startA.isBefore(endB) && startB.isBefore(endA) && !endA.isBefore(startB) && !endB.isBefore(startA)
}

export const usePricesStore = create<PricesState>((set, get) => ({
  prices: [],
  priceHistory: [],
  hydrate: (prices, history) => set({ prices, priceHistory: history }),
  checkConflict: (skuId, channelId, startAt, endAt, excludeId) =>
    get().prices.filter(
      (p) =>
        p.sku_id === skuId &&
        p.channel_id === channelId &&
        p.id !== excludeId &&
        p.status !== '已失效' &&
        overlap(p.start_at, p.end_at, startAt, endAt),
    ),
  upsertPrice: (price) =>
    set((state) => {
      const exists = state.prices.some((p) => p.id === price.id)
      return {
        prices: exists ? state.prices.map((p) => (p.id === price.id ? price : p)) : [price, ...state.prices],
      }
    }),
  activatePrice: (priceId) =>
    set((state) => {
      const target = state.prices.find((p) => p.id === priceId)
      if (!target) return state
      const updated = state.prices.map((p) => {
        if (p.id === priceId) {
          return { ...p, status: '生效' }
        }
        if (p.sku_id === target.sku_id && p.channel_id === target.channel_id && p.status === '生效') {
          const newEnd = dayjs(target.start_at).subtract(1, 'day').format('YYYY-MM-DD')
          return { ...p, status: '已失效', end_at: newEnd }
        }
        return p
      })
      return { prices: updated }
    }),
  cloneActiveToDraft: (skuId, channelId) => {
    const active = get().prices.find((p) => p.sku_id === skuId && p.channel_id === channelId && p.status === '生效')
    if (!active) return null
    return {
      ...active,
      id: nanoid(8),
      status: '草稿',
    }
  },
  addHistory: (history) =>
    set((state) => ({
      priceHistory: [
        {
          ...history,
          id: nanoid(8),
          operated_at: history.operated_at ?? dayjs().toISOString(),
        },
        ...state.priceHistory,
      ],
    })),
}))
