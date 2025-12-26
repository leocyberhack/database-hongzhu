import dayjs from 'dayjs'
import type { Inventory, Price, SkuChannel } from '../types'

export const overlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
  const startA = dayjs(aStart)
  const endA = dayjs(aEnd)
  const startB = dayjs(bStart)
  const endB = dayjs(bEnd)
  return startA.valueOf() <= endB.valueOf() && startB.valueOf() <= endA.valueOf()
}

export const findPriceConflicts = (prices: Price[], skuId: string, channelId: string, start: string, end: string, excludeId?: string) =>
  prices.filter(
    (p) => p.sku_id === skuId && p.channel_id === channelId && p.id !== excludeId && p.status !== '已失效' && overlap(p.start_at, p.end_at, start, end),
  )

export const skuShelfGates = (params: { skuId: string; skuChannels: SkuChannel[]; prices: Price[]; inventory: Inventory[] }) => {
  const { skuId, skuChannels, prices, inventory } = params
  const missing: string[] = []
  const hasChannel = skuChannels.some((c) => c.sku_id === skuId && c.status === '上架')
  if (!hasChannel) missing.push('未绑定渠道')

  const hasPrice = prices.some((p) => p.sku_id === skuId && p.status === '生效')
  if (!hasPrice) missing.push('缺生效价格')

  const sevenDaysAhead = dayjs().add(7, 'day')
  const hasInventory = inventory.some((inv) => {
    const left = inv.total_qty - inv.frozen_qty - inv.sold_qty
    return inv.sku_id === skuId && dayjs(inv.inventory_date).isBefore(sevenDaysAhead) && left > 0
  })
  if (!hasInventory) missing.push('未来 7 天无库存')

  return missing
}
