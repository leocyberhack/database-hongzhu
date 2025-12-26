# 红猪 OTA 内部管理原型（React + TS + Vite）

## 快速开始
- 安装依赖：`cd prototype && npm install`
- 本地运行：`npm run dev`（默认端口 5173）
- 所有数据均来自 `public/mock/*.json`，前端态（Zustand）在运行时写入审批、库存流水、审计日志等。

## 必看页面/链路（演示给总经理）
1) **上新链路**：资源判重 → 产品结构 hash 判重 → SKU 渠道绑定 → 上架闸门校验（缺价格/库存/渠道均阻断）  
   路径：资源库 `/resources/poi` → 产品列表/编辑 `/products` `/products/new` → SKU 列表 `/skus`
2) **调价审批链路**：复制生效版生成草稿、时间冲突前端阻断、审批通过自动失效旧版并截断时间、写审计日志  
   路径：定价中心 `/pricing` → 待审批 `/approvals`
3) **订单/库存/报表链路**：新建/导入订单自动冻结库存 → 核销/退款驱动库存流水 → 报表中心查看 KPI、趋势、TopN 下钻  
   路径：订单 `/orders` → 库存 `/inventory` → 报表 `/reports` & Dashboard `/dashboard/management`

## 模块导航
- Dashboard：管理层 / 运营 / 产品看板（Recharts）
- M2 资源库：POI 判重、Resource 可能重复（允许强制创建）
- M1 供应商：供给关系、结算价历史、调价走审批
- M3 产品：structure_hash 判重、已有订单禁止改结构（引导复制为新产品）
- M4 SKU & 渠道：渠道绑定 + 上架闸门校验（价格/库存/渠道）
- M5 定价：调价弹窗、时间冲突阻断、版本化 + 审批
- M6 库存：日历表格视图、批量初始化、人工调整写 inventory_log
- M7 订单：新建/导入（CSV/JSON），自动冻结库存，核销/退款驱动库存变化
- M8 审批与审计：待审批、审批详情 diff、审计日志查询
- 报表中心：日/周/月切换，KPI、趋势、Top 渠道/SKU/产品

## Mock 数据覆盖的边界场景
- POI 同名同城候选、Resource 可能重复
- 产品结构判重命中、已有订单的产品
- 缺价格/缺库存/未绑渠道的 SKU 上架闸门失败
- 价格区间冲突草稿、成本缺失订单、已支付未核销订单
- 5+ 待审批（product/sku/price/inventory/supplier），审计日志含调价/上下架/库存调整/订单状态

## 账号/角色（前端 mock）
- 产品经理：pm.zhang（上新、调价发起）
- 运营：运营.yu（库存、渠道、导入订单）
- 客服：客服（录单、核销/退款）
- 审批人：主管
