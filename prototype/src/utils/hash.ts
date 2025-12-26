import type { ProductResource } from '../types'

export const buildStructureHash = (items: ProductResource[]) => {
  const base = items
    .slice()
    .sort((a, b) => a.resource_id.localeCompare(b.resource_id))
    .map((item) => `${item.resource_id}:${item.quantity}:${item.required_flag ? 1 : 0}`)
    .join('|')

  let hash = 0
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash << 5) - hash + base.charCodeAt(i)
    hash |= 0
  }
  return `${base}::${Math.abs(hash).toString(16)}`
}
