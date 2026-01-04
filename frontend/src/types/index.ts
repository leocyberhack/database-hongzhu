// Core entity types matching backend schema

export interface POI {
    id: string
    poi_name: string
    city: string
    address?: string
    attrs?: Record<string, unknown>
    created_at?: string
    updated_at?: string
}

export interface Resource {
    id: string
    poi_id: string
    resource_name: string
    resource_type: string
    attrs?: Record<string, unknown>
    status?: string
    created_at?: string
    updated_at?: string
}

export interface Supplier {
    id: string
    supplier_name: string
    status: 'active' | 'inactive' | 'pending'
    contact_info?: {
        contact_name?: string
        contact_phone?: string
    }
    settlement_info?: Record<string, unknown>
    qualification_files?: any[]
    tags?: string[]
    remark?: string
    created_at?: string
    updated_at?: string
}

export interface SupplierResource {
    id: string
    supplier_id: string
    resource_id: string
    settlement_price?: number
    supply_status?: string
    currency?: string
    rule?: Record<string, unknown>
    priority?: number
    status: 'active' | 'inactive'
    created_at?: string
    updated_at?: string
}

export interface SupplierResourcePriceHistory {
    id: string
    supplier_resource_id: string
    before_price?: number
    after_price: number
    reason?: string
    operator?: string
    operated_at: string
}


export interface ProductCategory {
    id: string
    name: string
    status: 'active' | 'inactive'
    description?: string
    created_at?: string
}

export interface Product {
    id: string
    product_name: string
    description?: string
    structure_hash: string
    status: 'draft' | 'active' | 'archived'
    category_id?: string
    suggested_price?: number
    poi_id?: string
    created_at?: string
    updated_at?: string
}

export interface ProductResource {
    id: string
    product_id: string
    resource_id: string
    supplier_id?: string
    quantity: number
    required_flag: boolean
    remark?: string
}


export interface ProductStructureSnapshot {
    id: string
    product_id: string
    snapshot_json: string
    created_at?: string
}

export interface SKU {
    id: string
    product_id: string
    sku_name: string
    status: 'draft' | 'active' | 'offline' | 'archived'
    poi_id?: string
    attrs?: Record<string, unknown>
    created_at?: string
    updated_at?: string
}

export interface Channel {
    id: string
    name: string
    channel_type: string
    status: 'active' | 'inactive'
    created_at?: string
    updated_at?: string
}

export interface SKUChannel {
    id: string
    sku_id: string
    channel_id: string
    status: 'active' | 'inactive'
    created_at?: string
}

export interface Price {
    id: string
    sku_id: string
    channel_id: string
    sale_price: number
    start_at: string
    end_at?: string
    status: 'draft' | 'pending' | 'active' | 'expired' | 'rejected'
    version: number
    created_at?: string
    updated_at?: string
}

export interface PriceHistory {
    id: string
    price_id: string
    old_price?: number
    new_price: number
    changed_at: string
    reason?: string
}

export interface Inventory {
    id: string
    sku_id: string
    channel_id: string
    date: string
    total_qty: number
    frozen_qty: number
    available_qty: number
    created_at?: string
    updated_at?: string
}

export interface InventoryLog {
    id: string
    inventory_id: string
    action: 'freeze' | 'unfreeze' | 'verify' | 'adjust'
    quantity: number
    order_id?: string
    reason?: string
    created_at?: string
}

export interface Order {
    id: string
    order_no: string
    channel_id: string
    sku_id: string
    product_id: string
    quantity: number
    sale_price: number
    sale_amount: number
    cost_price?: number
    cost_amount?: number
    profit_amount?: number
    travel_date: string
    status: 'pending' | 'frozen' | 'verified' | 'refunded' | 'cancelled'
    created_at?: string
    updated_at?: string
}

export interface OrderStatusHistory {
    id: string
    order_id: string
    old_status?: string
    new_status: string
    changed_at: string
    reason?: string
}

export interface Approval {
    id: string
    object_type: string
    object_id: string
    action_type: string
    status: 'pending' | 'approved' | 'rejected'
    submitted_by: string
    reviewed_by?: string
    diff_json?: string
    created_at?: string
    updated_at?: string
}

export interface AuditLog {
    id: string
    object_type: string
    object_id: string
    action: string
    actor: string
    diff_json?: string
    created_at?: string
}

// Aggregate data container
export interface MockData {
    poi: POI[]
    resources: Resource[]
    suppliers: Supplier[]
    supplier_resources: SupplierResource[]
    supplier_resource_price_history: SupplierResourcePriceHistory[]
    product_categories: ProductCategory[]
    products: Product[]
    product_resources: ProductResource[]
    product_structure_snapshot: ProductStructureSnapshot[]
    skus: SKU[]
    channels: Channel[]
    sku_channels: SKUChannel[]
    prices: Price[]
    price_history: PriceHistory[]
    inventory: Inventory[]
    inventory_log: InventoryLog[]
    orders: Order[]
    order_status_history: OrderStatusHistory[]
    approvals: Approval[]
    audit_log: AuditLog[]
}
