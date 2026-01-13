# 红猪数据库架构文档 (Database Schema Documentation)

本文档详细描述了系统的数据库表结构、字段定义及关系。

> **注意**: 
> - `JSONB` 类型的字段通常用于存储灵活的扩展属性或结构化配置。
> - 所有时间字段默认带时区存储。

---

## 目录

1. [基础系统 (System)](#1-基础系统-system)
2. [资源中心 (Resource Center)](#2-资源中心-resource-center)
3. [产品中心 (Product Center)](#3-产品中心-product-center)
4. [SKU与渠道 (SKU & Channel)](#4-sku与渠道-sku--channel)
5. [库存与价格 (Inventory & Price)](#5-库存与价格-inventory--price)
6. [订单系统 (Order System)](#6-订单系统-order-system)
7. [审批与审计 (Approval & Audit)](#7-审批与审计-approval--audit)

---

## 1. 基础系统 (System)

### 1.1 用户表 (User)
表名: `user`
用于存储系统后台用户的基本信息。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | 用户ID | 主键 |
| username | String | 是 | - | 用户名 | 唯一 |
| password_hash | String | 是 | - | 密码哈希 | |
| role | String | 是 | 'guest' | 角色 | 权限控制 (admin, product, finance等) |
| created_at | DateTime | 否 | Now | 创建时间 | |

---

## 2. 资源中心 (Resource Center)

### 2.1 POI/兴趣点表 (Poi)
表名: `poi`
定义资源所在的地理位置或场馆信息（如：北京环球影城、某某酒店）。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | POI ID | 主键 |
| poi_name | String | 是 | - | POI名称 | (poi_name, city) 唯一组合 |
| city | String | 是 | - | 所在城市 | |
| poi_type | String | 否 | - | 类型 | 景区、酒店、交通枢纽等 |
| address | String | 否 | - | 详细地址 | |
| tags | JSONB | 否 | - | 标签 | 字符串数组 |
| status | String | 是 | 'active' | 状态 | active (启用), inactive (停用) |
| created_at | DateTime | 否 | Now | 创建时间 | |
| updated_at | DateTime | 否 | Now | 更新时间 | |

### 2.2 资源表 (Resource)
表名: `resource`
系统的核心原子单元，代表具体的服务项（如：成人票、大床房）。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | 资源ID | 主键 |
| poi_id | BigInteger | 是 | - | 所属POI | 外键 -> poi.id |
| resource_name | String | 是 | - | 资源名称 | |
| resource_type | String | 是 | - | 资源类型 | 门票, 酒店, 餐饮, 交通, 组合, 其他 |
| attrs | JSONB | 否 | - | **特定属性** | 详见下方结构说明 |
| status | String | 是 | 'draft' | 状态 | draft, active, archived |
| created_at | DateTime | 否 | Now | 创建时间 | |
| updated_at | DateTime | 否 | Now | 更新时间 | |

#### `attrs` 字段结构说明 (JSONB)

Resource表的`attrs`字段根据`resource_type`存储不同类型资源的特定属性。所有字段均为可选(Optional)。

#### 门票资源 (Ticket) - 共20个字段

| 字段名 | 类型 | 中文说明 | 示例/备注 |
| :--- | :--- | :--- | :--- |
| ticket_type | String(枚举) | 票种 | 成人票/儿童票/学生票/老人票/双人票 |
| address | String | 地址 | 门票使用地址 |
| entrance_times | String | 入园次数 | "unlimited"或具体次数 |
| age_limit | Object | 年龄限制 | {"min": 0, "max": 65} |
| includes | String | 包含内容 | 门票包含的项目 |
| excludes | String | 不包含内容 | 门票不包含的项目 |
| earliest_entry_time | String | 最早入园时间 | 格式：HH:MM，如"08:00" |
| latest_entry_time | String | 最晚入园时间 | 格式：HH:MM，如"18:00" |
| advance_booking_days | Integer | 提前预定天数 | ≥0 |
| advance_booking_time | Object | 提前预定时间 | {"hours": 2, "minutes": 30} |
| phone | String | 联系电话 | |
| description | String | 详细介绍 | |
| pickup_location | String | 取票地址 | |
| available_after_issue | String | 出票后可用时间 | 如"立即可用"/"24小时后可用" |
| required_traveler_info | Array | 所需出行人信息 | ["身份证", "手机号", "姓名"] |
| voucher_type | Array | 凭证类型 | ["身份证", "二维码", "手机号"] |
| purchase_limit | String | 限购规则 | |
| refund_policy | String | 退票规则 | |
| play_duration | Float | 游玩时间（小时） | ≥0，如3.5表示3.5小时 |
| additional_notes | String | 补充说明 | |

#### 酒店资源 (Hotel) - 共24个字段

| 字段名 | 类型 | 中文说明 | 示例/备注 |
| :--- | :--- | :--- | :--- |
| room_type | String(枚举) | 房型 | 标准/行政/豪华/套房 |
| bed_type | String(枚举) | 床型 | 大床/双床/亲子 |
| hotel_type | String(枚举) | 酒店类型 | 经济型/豪华型 |
| phone | String | 联系电话 | |
| address | String | 详细地址 | |
| max_occupancy | Integer | 最大入住人数 | ≥1 |
| breakfast_included | Boolean | 是否含早餐 | true/false |
| star_rating | String(枚举) | 酒店星级 | 五星/四星/三星/无 |
| cancellation_policy | String | 取消/退款政策 | |
| purchase_limit | String | 限购规则 | |
| required_traveler_info | Array | 所需出行人信息 | ["身份证", "手机号", "姓名"] |
| description | String | 详细介绍 | |
| check_in_time | String | 最早入住时间 | 格式：HH:MM，如"14:00" |
| check_out_time | String | 最晚退房时间 | 格式：HH:MM，如"12:00" |
| advance_booking_days | Integer | 提前预定天数 | ≥0 |
| parking | String(枚举) | 停车场 | 无/免费/付费 |
| has_pickup_service | Boolean | 接机/接站服务 | true/false |
| has_24h_reception | Boolean | 24小时前台 | true/false |
| has_luggage_storage | Boolean | 行李寄存 | true/false |
| has_restaurant | Boolean | 有餐厅 | true/false |
| extra_services | String | 其他额外服务 | |
| area | Float | 面积（平米） | ≥0 |
| special_settlement_rules | String | 特殊结算规则 | |
| additional_notes | String | 补充说明 | |

#### 餐饮资源 (Dining) - 共9个字段

| 字段名 | 类型 | 中文说明 | 示例/备注 |
| :--- | :--- | :--- | :--- |
| meal_types | Array | 餐饮类型（多选） | ["早餐", "午餐", "晚餐"] |
| dining_category | String(枚举) | 餐饮分类 | 正餐/小吃 |
| restaurant_name | String | 餐厅名称 | |
| restaurant_address | String | 餐厅地址 | |
| phone | String | 联系电话 | |
| opening_time | String | 营业开始时间 | 格式：HH:MM，如"10:00" |
| closing_time | String | 营业结束时间 | 格式：HH:MM，如"22:00" |
| reservation_required | Boolean | 是否需要预定 | true/false |
| additional_notes | String | 补充说明 | |

#### 交通资源 (Transport) - 共6个字段

| 字段名 | 类型 | 中文说明 | 示例/备注 |
| :--- | :--- | :--- | :--- |
| transport_type | String(枚举) | 交通类型 | 大巴/商务车/轿车 |
| departure | String | 起点 | |
| destination | String | 终点 | |
| max_seats | Integer | 最大座位数 | ≥1 |
| duration | String | 行程时长 | 如"2小时30分钟" |
| additional_notes | String | 补充说明 | |

#### 通用资源 (Generic) - 用于组合等其他类型

| 字段名 | 类型 | 中文说明 | 示例/备注 |
| :--- | :--- | :--- | :--- |
| notes | String | 通用备注 | |
| extra | Object | 其他扩展字段 | 保持灵活性的自由字段 |

### 2.3 供应商表 (Supplier)
表名: `supplier`
提供资源的第三方或内部供应商。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | 供应商ID | 主键 |
| supplier_name | String | 是 | - | 供应商名称 | 唯一 |
| contact_info | JSONB | 否 | - | 联系人信息 | |
| settlement_info | JSONB | 否 | - | 结算账户信息 | |
| qualification_files | JSONB | 否 | - | 资质文件 | 文件路径列表 |
| tags | JSONB | 否 | - | 标签 | |
| remark | Text | 否 | - | 备注 | |

### 2.4 供应商资源关联表 (Supplier Resource)
表名: `supplier_resource`
建立供应商与资源的供应关系（采购关系）。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| supplier_id | BigInteger | 是 | - | 供应商 | 外键 -> supplier.id |
| resource_id | BigInteger | 是 | - | 资源 | 外键 -> resource.id |
| supply_status | String | 是 | 'active' | 供应状态 | active, suspend |
| settlement_price | Numeric | 否 | - | 默认结算价 | (12, 2) |
| currency | String | 否 | - | 币种 | CNY, USD |
| rule | JSONB | 否 | - | 供应规则 | 预定规则等 |
| priority | Integer | 否 | 1 | 优先级 | |

### 2.5 资源库存表 (Resource Inventory)
表名: `resource_inventory`
记录供应商资源的每日库存水位。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| supplier_resource_id | BigInteger | 是 | - | 供应商资源 | 外键 -> supplier_resource.id |
| inventory_date | Date | 是 | - | 库存日期 | YYYY-MM-DD |
| total_qty | Integer | 是 | 0 | 总容量 | |
| frozen_qty | Integer | 是 | 0 | 冻结数量 | 下单未核销 |
| sold_qty | Integer | 是 | 0 | 已售数量 | 已核销 |
| settlement_price | Numeric | 否 | - | 当日结算价 | 覆盖默认结算价 |
| status | String | 是 | 'active' | 状态 | |

---

## 3. 产品中心 (Product Center)

### 3.1 产品分类表 (Product Category)
表名: `product_category`

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | 分类ID | 主键 |
| name | String | 是 | - | 分类名称 | |
| description | Text | 否 | - | 描述 | |

### 3.2 产品表 (Product)
表名: `product`
由一个或多个资源组合而成的可售卖单元模板（无具体日期）。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | 产品ID | 主键 |
| product_name | String | 是 | - | 产品名称 | |
| category_id | BigInteger | 否 | - | 产品分类 | 外键 -> product_category.id |
| poi_id | BigInteger | 否 | - | 主要POI | 自动推算，外键 -> poi.id |
| description | Text | 否 | - | 描述 | |
| status | String | 是 | 'draft' | 状态 | draft, active, archived |
| suggested_price | Numeric | 否 | - | 建议零售价 | |
| base_cost | Numeric | 否 | - | 基础成本 | 自动计算 |
| structure_hash | String | 是 | - | 结构哈希 | 用于校验结构唯一性 |
| allowed_channels | JSONB | 否 | - | 渠道配额配置 | [{channel_id, stock_ratio}] |

### 3.3 产品资源组合表 (Product Resource)
表名: `product_resource`
定义产品的BOM（物料清单）结构。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| product_id | BigInteger | 是 | - | 产品 | 外键 -> product.id |
| resource_id | BigInteger | 是 | - | 资源 | 外键 -> resource.id |
| supplier_id | BigInteger | 否 | - | 指定供应商 | 外键 -> supplier.id |
| quantity | Integer | 是 | - | 数量 | 组成该产品需要的资源数量 |
| required_flag | Boolean | 是 | true | 是否必选 | |
| remark | Text | 否 | - | 备注 | |

### 3.4 产品结构快照表 (Product Structure Snapshot)
表名: `product_structure_snapshot`
用于历史追溯，记录产品在某一时刻的资源组合结构。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| product_id | BigInteger | 是 | - | 产品 | 外键 -> product.id |
| snapshot_data | JSONB | 是 | - | 快照数据 | 完整的资源组合列表JSON |
| created_at | DateTime | 否 | Now | 快照时间 | |

---

## 4. SKU与渠道 (SKU & Channel)

### 4.1 渠道表 (Channel)
表名: `channel`
销售渠道（如：抖音、携程、线下门店）。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | 渠道ID | 主键 |
| channel_name | String | 是 | - | 渠道名称 | |
| channel_type | String | 否 | - | 类型 | OTA, Agency, Direct |
| commission_rate | Numeric | 否 | - | 佣金率 | 百分比 (0.05 = 5%) |
| parent_id | Integer | 否 | - | 父渠道 | 支持层级 |
| attrs | JSONB | 否 | - | 扩展属性 | API配置等 |

### 4.2 SKU表 (Sku)
表名: `sku`
具体的上架商品单元（Stock Keeping Unit），关联产品与日期/渠道。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | SKU ID | 主键 |
| product_id | BigInteger | 是 | - | 关联产品 | 外键 -> product.id |
| sku_name | String | 是 | - | SKU名称 | 通常基于产品名+规格 |
| sku_type | String | 否 | - | 类型 | Calendar, Package |
| status | String | 是 | 'draft' | 状态 | draft, active, offline, archived |
| sale_start | Date | 否 | - | 只在期间售卖 | |
| sale_end | Date | 否 | - | | |
| travel_start | Date | 否 | - | 适用出行日期 | |
| travel_end | Date | 否 | - | | |

### 4.3 SKU渠道关联表 (Sku Channel)
表名: `sku_channel`
SKU在特定渠道的上架关系。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| sku_id | BigInteger | 是 | - | SKU | 外键 -> sku.id |
| channel_id | BigInteger | 是 | - | 渠道 | 外键 -> channel.id |
| channel_sku_code | String | 否 | - | 渠道方编码 | 外部ID |
| status | String | 是 | 'active' | 状态 | |

---

## 5. 库存与价格 (Inventory & Price)

### 5.1 SKU价格表 (Price)
表名: `price`
定义SKU在特定渠道和日期范围内的售价。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| sku_id | BigInteger | 是 | - | SKU | 外键 -> sku.id |
| channel_id | BigInteger | 是 | - | 渠道 | 外键 -> channel.id |
| sale_price | Numeric | 是 | - | 销售价 | |
| cost_price | Numeric | 否 | - | 成本价 | 可覆盖产品基础成本 |
| start_at | Date | 是 | - | 开始日期 | |
| end_at | Date | 是 | - | 结束日期 | |
| status | String | 是 | 'draft' | 状态 | |

### 5.2 SKU库存表 (Inventory)
表名: `inventory`
**注意**：这是SKU层面的库存（成品库存），区别于资源库存。通常用于买断库存或虚拟库存。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| sku_id | BigInteger | 是 | - | SKU | 外键 -> sku.id |
| inventory_date | Date | 是 | - | 库存日期 | |
| total_qty | Integer | 是 | 0 | 总数量 | |
| sold_qty | Integer | 是 | 0 | 已售 | |
| frozen_qty | Integer | 是 | 0 | 冻结 | |
| status | String | 是 | 'normal' | 状态 | |

### 5.3 库存/价格日志表 (Inventory Log / Price History)
- `inventory_log`: 记录SKU库存的所有变更（下单、退款、手动调整）。
- `price_history`: 记录价格的审批和变更历史。

---

## 6. 订单系统 (Order System)

### 6.1 订单表 (Order)
表名: `order`

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | 订单ID | 主键 |
| order_no | String | 是 | - | 订单号 | 唯一 |
| channel_id | BigInteger | 是 | - | 来源渠道 | 外键 -> channel.id |
| sku_id | BigInteger | 是 | - | 购买SKU | 外键 -> sku.id |
| product_id | BigInteger | 是 | - | 购买产品 | 外键 -> product.id |
| travel_date | Date | 是 | - | 出行日期 | |
| quantity | Integer | 是 | 1 | 数量 | |
| sale_price | Numeric | 是 | - | 销售单价 | |
| sale_amount | Numeric | 是 | - | 销售总额 | |
| cost_amount | Numeric | 否 | - | 成本总额 | |
| profit_amount | Numeric | 否 | - | 利润总额 | |
| status | String | 是 | 'paid' | 状态 | pending, paid, confirmed, completed, cancelled, refunded |
| verified_at | DateTime | 否 | - | 核销时间 | |
| refunded_at | DateTime | 否 | - | 退款时间 | |

### 6.2 订单状态历史 (Order Status History)
表名: `order_status_history`
记录订单全生命周期的状态流转。

---

## 7. 审批与审计 (Approval & Audit)

### 7.1 审批表 (Approval)
表名: `approval`
用于价格变更、库存调整等敏感操作的审批流。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| object_type | String | 是 | - | 对象类型 | sku, price, inventory |
| object_id | BigInteger | 是 | - | 对象ID | |
| action_type | String | 是 | - | 动作类型 | update_price, etc. |
| before/after_data | JSONB | 否 | - | 变更前后数据 | |
| status | String | 是 | 'pending' | 审批状态 | pending, approved, rejected |

### 7.2 审计日志表 (Audit Log)
表名: `audit_log`
系统级的操作痕迹记录，用于安全审计和问题追踪。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | ID | 主键 |
| table_name | String | 是 | - | 表名 | |
| record_id | BigInteger | 是 | - | 记录ID | |
| operation | String | 是 | - | 操作类型 | CREATE, UPDATE, DELETE |
| diff_data | JSONB | 否 | - | 差异数据 | 保存变更字段的内容 |
| operator | String | 否 | - | 操作人 | |
| operated_at | DateTime | 是 | Now | 操作时间 | |
