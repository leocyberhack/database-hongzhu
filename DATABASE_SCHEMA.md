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
| poi_type | String | 是 | - | 类型 | 枚举: 门票, 酒店, 餐饮, 交通 |
| poi_code | String | 否 | - | POI编码 | |
| province | String | 否 | - | 省份 | |
| city | String | 是 | - | 所在城市 | |
| district | String | 否 | - | 区县 | |
| address | String | 否 | - | 详细地址 | |
| longitude | Numeric(10,6) | 否 | - | 经度 | |
| latitude | Numeric(10,6) | 否 | - | 纬度 | |
| tags | JSONB | 否 | - | 标签 | 字符串数组 |
| attrs | JSONB | 否 | - | **扩展属性** | 不同类型的通用属性 |
| status | String | 是 | 'active' | 状态 | active (启用), inactive (停用) |
| folder_id | BigInteger | 否 | - | 关联文件夹 | 外键 -> folder.id |
| created_at | DateTime | 否 | Now | 创建时间 | |
| updated_at | DateTime | 否 | Now | 更新时间 | |

#### `poi.attrs` 字段结构说明 (JSONB)

**门票 POI (Ticket)**
包含景区的地理、服务及入园信息。
| 字段名 | 说明 | 示例 |
| :--- | :--- | :--- |
| province/city/district | 省市区 | |
| entrance_times | 入园次数 | unlimited/1 |
| earliest/latest_entry_time | 入园时间限制 | 08:00 / 17:00 |
| entry_method | 入园方式 | 刷身份证/扫码 |
| pickup_location/method | 取票信息 | |
| phone | 联系电话 | |
| description | 详细介绍 | |
| required_traveler_info | 所需出行人信息 | ["姓名", "手机号"] |
| has_parking/parking_info | 停车场信息 | |
| highlights | 景区亮点 | |

**酒店 POI (Hotel)**
包含酒店的星级、设施及政策。
| 字段名 | 说明 | 示例 |
| :--- | :--- | :--- |
| hotel_type | 酒店类型 | 经济型/豪华型 |
| star_rating | 星级 | 五星/无 |
| phone | 联系电话 | |
| check_in/out_time | 入离时间 | 14:00 / 12:00 |
| parking | 停车场 | 免费/付费 |
| has_restaurant/gym... | 设施服务 | true/false (餐厅/行李寄存等) |
| cancellation_policy | 取消政策 | |
| description | 详细介绍 | |

**餐饮 POI (Dining)**
| 字段名 | 说明 | 示例 |
| :--- | :--- | :--- |
| restaurant_name | 餐厅名称 | |
| phone | 联系电话 | |
| opening/closing_time | 营业时间 | 10:00 - 22:00 |
| parking | 停车场信息 | |
| description | 详细介绍 | |

**交通 POI (Transport)**
暂无特定通用属性。

### 2.2 资源表 (Resource)
表名: `resource`
系统的核心原子单元，代表具体的服务项（如：成人票、大床房）。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | 资源ID | 主键 |
| poi_id | BigInteger | 是 | - | 所属POI | 外键 -> poi.id |
| resource_name | String | 是 | - | 资源名称 | |
| resource_code | String | 否 | - | 资源编码 | |
| resource_type | String | 是 | - | 资源类型 | 门票, 酒店, 餐饮, 交通 |
| attrs | JSONB | 否 | - | **特定属性** | 详见下方结构说明 |
| status | String | 是 | 'draft' | 状态 | draft, active, archived |
| created_at | DateTime | 否 | Now | 创建时间 | |
| updated_at | DateTime | 否 | Now | 更新时间 | |

#### `resource.attrs` 字段结构说明 (JSONB)
仅包含资源维度的独有属性（公共属性如地址/电话等已上浮至POI）：

`resource_type` 限定为：**Ticket, Hotel, Dining, Transport**。

**门票资源 (Ticket)**
| 字段名 | 中文说明 | 示例 |
| :--- | :--- | :--- |
| ticket_type | 票种 | 成人票/儿童票 |
| advance_booking_days | 提前预定天数 | |
| includes | 包含内容 | |
| excludes | 不包含内容 | |
| age/height_limit | 年龄/身高限制 | {"min":0, "max":100} |
| play_duration | 游玩时长 | 3.5 (小时) |
| refund_policy | 退票规则 | |
| additional_notes | 补充说明 | |

**酒店资源 (Hotel)**
| 字段名 | 中文说明 | 示例 |
| :--- | :--- | :--- |
| room_type | 房型 | 标准/大床 |
| bed_type | 床型 | 双床/大床 |
| max_occupancy | 最大入住人数 | 2 |
| breakfast_included | 含早 | true/false |
| area | 面积 | 25.5 |
| has_window | 有窗 | true/false |
| room_facilities | 房间设施 | ["Wifi", "吹风机"] |
| additional_notes | 备注 | |

**餐饮资源 (Dining)**
| 字段名 | 中文说明 | 示例 |
| :--- | :--- | :--- |
| meal_types | 餐饮类型 | ["午餐", "晚餐"] |
| dining_category | 餐饮分类 | 正餐/小吃 |
| includes_details | 包含内容详情 | 套餐明细 |
| suitable_for_people | 适配人数 | 2 |
| reservation_required | 需要预定 | true/false |
| additional_notes | 补充说明 | |

**交通资源 (Transport)**
| 字段名 | 中文说明 | 示例 |
| :--- | :--- | :--- |
| transport_type | 交通类型 | 商务车/大巴 |
| departure | 起点 | |
| destination | 终点 | |
| max_seats | 最大座位数 | 7 |
| duration | 行程时长 | 2小时 |
| additional_notes | 补充说明 | |



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
| attrs | JSONB | 否 | - | 扩展属性 | 供应商业务信息 |
| contract_start_date | Date | 否 | - | 合同开始日期 | |
| contract_end_date | Date | 否 | - | 合同结束日期 | |
| folder_id | BigInteger | 否 | - | 关联文件夹 | 外键 -> folder.id |
| created_at | DateTime | 否 | Now | 创建时间 | |
| updated_at | DateTime | 否 | Now | 更新时间 | |

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
| created_at | DateTime | 否 | Now | 创建时间 | |

### 4.2 SKU表 (Sku)
表名: `sku`
具体的上架商品单元（Stock Keeping Unit），关联产品与日期/渠道。

| 字段名 | 类型 | 必填 | 默认值 | 中文说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| id | BigInteger | 是 | Auto Inc | SKU ID | 主键 |
| product_id | BigInteger | 是 | - | 关联产品 | 外键 -> product.id |
| poi_id | BigInteger | 否 | - | 关联POI | 外键 -> poi.id |
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
