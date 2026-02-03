# 红猪数据库 (Red Pig Database)

面向 OTA/旅游业务的全链路资源、商品、定价与订单管理系统，涵盖 资源(POI)/子资源(Resource)、供应商、产品、SPU/SKU/渠道、价格、库存、订单、审批与审计等模块，配套 React 管理后台。前端展示口径：POI 显示为“资源”，Resource 显示为“子资源”。

## 技术栈
- 后端：FastAPI (Python 3.10+)、SQLAlchemy Async、Pydantic v2、Alembic、python-jose、passlib
- 数据库：PostgreSQL（异步连接池，Alembic 迁移）
- 前端：React 19 + TypeScript + Vite + Ant Design 6 + React Router 7 + dayjs + Recharts
- 鉴权与审计：JWT + RBAC（角色/审批拦截）+ 审计日志；支持基于请求头的操作人透传

## 目录速览
- `backend/`：FastAPI 应用  
  - `app/api/endpoints/`：业务接口（auth、resources/poi(资源/子资源)、suppliers、products、spus、skus、channels、pricing、inventory、orders、approvals、audit、reports、files 等）  
  - `app/core/`：配置、数据库、鉴权、操作人上下文  
  - `app/models/`：SQLAlchemy 模型（资源/产品/价格/库存/订单/审批/审计等表）  
  - `app/schemas/`：Pydantic 输入/输出模型  
  - `alembic/`：数据库迁移
- `frontend/`：React 管理端  
  - `src/pages/`：功能页（资源中心、供应商、产品、SPU、SKU/渠道、定价中心、库存、订单、订单导入、审批、报表、用户等）  
  - `src/components/`：通用组件（SKU 日历编辑器、库存预览等）  
  - `src/contexts/`：鉴权与数据上下文  
  - `src/lib/api.ts`：API 客户端与鉴权存储
- 其他：`permission_system.md`（角色/审批规则）、`产品文档.md`（产品方案与数据模型）

## 核心能力（后端 API 与前端页面）
- 身份/权限/审批：账号登录、用户/角色管理（仅超管）、JWT 鉴权；非管理员的敏感操作会生成 `Approval` 待审；全量审计日志 `AuditLog`；操作人从 `Authorization` 或 `X-User/X-Role` 头注入。
- 资源(POI) / 子资源(Resource) / 供应商：资源、子资源 CRUD（含唯一性校验与审计）；供应商 CRUD；供应商-子资源绑定，结算价调价写入历史与审批；供应商子资源日历库存批量设置（含工作日筛选、日结算价）。
- 产品与分类：产品分类 CRUD；产品创建/编辑（子资源行、可售渠道 `allowed_channels`、结构哈希去重、防重复子资源）；产品结构快照；按子资源库存计算产品可售量与预览。
- SPU/SKU 与渠道：SPU 管理；SKU CRUD（售卖/出行日期窗，绑定 SPU/产品，继承资源），非管理员编辑/上下架触发审批；渠道 CRUD（树形、佣金率、状态）及非管理员审批流；SKU-渠道绑定唯一校验；渠道库存占比用于 SKU 日库存上限计算。
- 定价：价格日历段创建支持自动处理重叠（切尾、拆段、覆盖），非管理员默认为 `pending` 待审；价格审批/决策接口；价格历史；定价总览 `pricing/summary` 汇总 SKU×渠道的当前价区间。
- 库存：SKU 日库存由产品子资源库存×渠道占比自动计算（木桶算法），手动初始化/调整已禁用；下单冻结/核销/退款更新 `frozen/sold`；子资源侧 `ResourceInventory` 支持批量设置（含结算价）；库存数据列表按全量计算后排序再分页。
- 订单：创建订单需选择渠道→SPU→SKU，支付时间必填；销售金额输入总额（系统折算单价）；状态字段为多组“是/否 + 时间 + 可选数量/金额”，全部独立字段；下单冻结 SKU 与子资源库存，核销/退款时消费或释放库存并记录状态历史；支持批量导入与模板下载。
- 报表：`/reports/summary` 提供 GMV/利润/订单量趋势以及渠道、SKU、产品 TOP 列表。

## 快速开始
### 前置
- Python 3.10+、Node.js 18+、PostgreSQL
- 复制 `backend/.env.example` 为 `.env` 并补充 `JWT_SECRET`、数据库连接等配置，API 前缀默认为 `/api`

### 启动后端
```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\activate   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head   # 迁移数据库
python -m uvicorn app.main:app --reload --port 8000
```
- 应用启动时会在用户表存在的情况下自动种子账号 `admin / dongyu1220`
- Swagger 文档：`http://127.0.0.1:8000/docs`

### 启动前端
```bash
cd frontend
npm install
# 可在 .env.local 设置 VITE_API_BASE=http://127.0.0.1:8000
npm run dev  # 默认端口 5173
```
- 以管理员登录可访问全部菜单，侧边导航会按角色动态收敛

### 迁移与开发提示
- 新表/字段：`alembic revision --autogenerate -m "desc"` 后执行 `alembic upgrade head`
- 前端校验：`npm run lint`
- API 基址 `/api`，CORS 已允许本地 5173~5176 端口
