export type Status = '草稿' | '待审批' | '上架' | '下架' | '生效' | '已失效' | '已支付' | '已核销' | '已退款'

export interface Poi {
  id: string
  poi_name: string
  poi_type?: string
  city: string
  address?: string
  status: string
  tags?: string[]
  remark?: string
}

export interface Resource {
  id: string
  poi_id: string
  resource_name: string
  resource_type: string
  attrs?: Record<string, unknown>
  status: string
}

export interface Supplier {
  id: string
  supplier_name: string
  supplier_type: string
  status: string
  contact_info?: Record<string, unknown>
  settlement_info?: Record<string, unknown>
  qualification_files?: Record<string, unknown>[]
  tags?: string[]
  remark?: string
}

export interface SupplierResource {
  id: string
  supplier_id: string
  resource_id: string
  supply_status: string
  settlement_price: number | null
  currency?: string
  priority?: number
  rule?: Record<string, unknown>
}

export interface SupplierResourcePriceHistory {
  id: string
  supplier_resource_id: string
  before_price: number | null
  after_price: number | null
  reason?: string
  operator?: string
  operated_at: string
  approval_id?: string
}

export interface Product {
  id: string
  product_name: string
  description?: string
  status: string
  structure_hash: string
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface ProductResource {
  id: string
  product_id: string
  resource_id: string
  quantity: number
  required_flag: boolean
  remark?: string
}

export interface ProductStructureSnapshot {
  id: string
  product_id: string
  snapshot_data: unknown
  created_at: string
}

export interface Sku {
  id: string
  product_id: string
  sku_name: string
  sku_type?: string
  sale_start?: string
  sale_end?: string
  travel_start?: string
  travel_end?: string
  status: string
  created_by?: string
}

export interface Channel {
  id: string
  channel_name: string
  channel_type?: string
  parent_id?: string | null
  attrs?: Record<string, unknown>
  status: string
}

export interface SkuChannel {
  id: string
  sku_id: string
  channel_id: string
  channel_sku_code?: string
  status: string
}

export interface Price {
  id: string
  sku_id: string
  channel_id: string
  sale_price: number
  cost_price: number | null
  start_at: string
  end_at: string
  status: string
  created_by?: string
}

export interface PriceHistory {
  id: string
  price_id: string
  before_data: unknown
  after_data: unknown
  operator?: string
  operated_at: string
  approval_id?: string
}

export interface Inventory {
  id: string
  sku_id: string
  inventory_date: string
  total_qty: number
  frozen_qty: number
  sold_qty: number
  status: string
}

export interface InventoryLog {
  id: string
  sku_id: string
  inventory_date: string
  change_type: string
  before_qty: {
    total: number
    frozen: number
    sold: number
  }
  after_qty: {
    total: number
    frozen: number
    sold: number
  }
  related_order_id?: string
  operator?: string
  operated_at: string
  remark?: string
}

export interface Order {
  id: string
  order_no: string
  channel_id: string
  sku_id: string
  product_id: string
  travel_date: string
  quantity: number
  sale_price: number
  sale_amount: number
  cost_price: number | null
  cost_amount: number | null
  profit_amount: number | null
  status: string
  created_by?: string
  created_at: string
  verified_at?: string
  refunded_at?: string
  remark?: string
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  before_status: string
  after_status: string
  operator?: string
  operated_at: string
  reason?: string
}

export interface Approval {
  id: string
  object_type: 'product' | 'sku' | 'price' | 'inventory' | 'supplier'
  object_id: string
  action_type: string
  before_data: unknown
  after_data: unknown
  status: '待审批' | '通过' | '驳回'
  applicant: string
  approver: string
  applied_at: string
  decided_at?: string
  comment?: string
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string
  operation: string
  diff_data: unknown
  operator?: string
  operated_at: string
  source?: string
}

export interface MockData {
  poi: Poi[]
  resources: Resource[]
  suppliers: Supplier[]
  supplier_resources: SupplierResource[]
  supplier_resource_price_history: SupplierResourcePriceHistory[]
  products: Product[]
  product_resources: ProductResource[]
  product_structure_snapshot: ProductStructureSnapshot[]
  skus: Sku[]
  channels: Channel[]
  sku_channels: SkuChannel[]
  prices: Price[]
  price_history: PriceHistory[]
  inventory: Inventory[]
  inventory_log: InventoryLog[]
  orders: Order[]
  order_status_history: OrderStatusHistory[]
  approvals: Approval[]
  audit_log: AuditLog[]
}

export interface ChartPoint {
  date: string
  gmv: number
  profit: number
  orders: number
}
