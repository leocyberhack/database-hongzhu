// Core entity types matching backend schema

export interface POI {
    id: string
    poi_name: string
    poi_type: string  // 景区/酒店/餐饮/交通
    poi_code?: string
    province?: string
    city: string
    district?: string
    address?: string
    longitude?: number
    latitude?: number
    folder_id?: number  // POI专属文件夹ID
    attrs?: Record<string, unknown>  // POI类型的通用字段
    type_options?: Record<string, unknown>
    created_at?: string
    updated_at?: string
}

export interface Resource {
    id: string
    poi_id: string
    resource_name: string
    resource_code?: string
    resource_type: string
    attrs?: Record<string, unknown>
    status?: string
    created_at?: string
    updated_at?: string
}

export interface Supplier {
    id: string
    supplier_name: string
    contact_info?: SupplierContact[]
    attrs?: Record<string, unknown>
    settlement_info?: Record<string, unknown>
    qualification_files?: any[]
    tags?: string[]
    remark?: string
    folder_id?: number
    created_at?: string
    updated_at?: string
}

export interface SupplierContact {
    name?: string
    phone?: string
    email?: string
    position?: string
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
    description?: string
    created_at?: string
}

// Channel allocation with stock ratio
export interface ChannelAllocation {
    channel_id: number
    stock_ratio: number  // Percentage (0-100), default 0
}

export interface Product {
    id: string
    product_name: string
    product_code?: string
    description?: string
    structure_hash: string
    status: 'draft' | 'active' | 'archived'
    category_id?: string
    suggested_price?: number
    base_cost?: number
    poi_id?: string
    allowed_channels?: ChannelAllocation[]  // Changed to array of allocations
    created_at?: string
    updated_at?: string
}

export interface ProductResource {
    id: string
    product_id: string
    resource_id: string
    supplier_id?: string // Deprecated
    supplier_mode?: 'auto' | 'locked'
    supplier_ids?: number[]
    quantity: number
    required_flag: boolean
    remark?: string
}


export interface ProductStructureSnapshot {
    id: string
    product_id: string
    snapshot_data: Record<string, unknown>[]
    created_at?: string
}

export interface Spu {
    id: string
    name: string
    spu_code?: string
    remark?: string
    sku_count?: number
    created_at?: string
    updated_at?: string
}

export interface SKU {
    id: string
    spu_id: string
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
    channel_name: string
    channel_type: string
    commission_rate?: number
    status?: string
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
    created_at?: string
    updated_at?: string
}

export interface PriceHistory {
    id: string
    price_id: string
    before_data?: Record<string, unknown>
    after_data?: Record<string, unknown>
    operator?: string
    operated_at: string
    approval_id?: number
}

export interface Inventory {
    id: string
    sku_id: string
    channel_id?: string
    inventory_date: string
    total_qty: number
    frozen_qty: number
    sold_qty?: number
    available_qty?: number
    created_at?: string
    updated_at?: string
}

export interface InventoryLog {
    id: string
    sku_id: string
    inventory_date: string
    change_type: string
    before_qty: Record<string, unknown>
    after_qty: Record<string, unknown>
    related_order_id?: string
    operator?: string
    operated_at?: string
    remark?: string
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
    status: 'paid' | 'verified' | 'refunded'
    created_at?: string
    updated_at?: string
}

export interface OrderStatusHistory {
    id: string
    order_id: string
    before_status?: string
    after_status: string
    operated_at: string
    operator?: string
    reason?: string
}

export interface Approval {
    id: number
    object_type: string
    object_id: number
    action_type: string
    status: 'pending' | 'approved' | 'rejected'
    applicant: string
    approver?: string
    before_data?: Record<string, any>
    after_data?: Record<string, any>
    applied_at: string
    decided_at?: string
    comment?: string
}

export interface AuditLog {
    id: string
    table_name: string
    record_id: string
    operation: string
    diff_data?: Record<string, unknown>
    operator?: string
    operated_at?: string
    source?: string
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
    spus: Spu[]
}
