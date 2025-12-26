# 演示与测试指南

## 启动方式
1. 进入原型目录：`cd prototype`
2. 安装依赖：`npm install`
3. 启动本地开发服务：`npm run dev`，浏览器访问 `http://localhost:5173`

## 推荐演示路径（3 条旅程）
1) **上新链路**：资源判重 `/resources/poi` → 产品编辑 `/products/new`（生成 structure_hash 判重）→ SKU 渠道绑定 `/skus`，查看上架闸门提示。  
2) **调价审批链路**：定价中心 `/pricing` 打开调价弹窗（时间冲突前端阻断）→ 待审批 `/approvals` 审批通过 → 审计日志 `/audit-log` 查看留痕。  
3) **订单-库存-报表链路**：订单 `/orders` 新建或导入 CSV（自动冻结库存）→ 核销/退款驱动库存变化 `/inventory` → 报表中心 `/reports` 查看 KPI/TopN。

## 测试账号/角色（前端 mock）
- 产品经理：`pm.zhang`（上新、调价发起）
- 运营：`运营.yu`（库存、渠道、导入订单）
- 客服：`客服`（录单、核销/退款）
- 审批人：`主管`

## 对外演示（外网穿透示例：ngrok + 4173 端口）
1. 安装并配置 ngrok（仅需一次）  
```powershell
cd $env:TEMP
Invoke-WebRequest -Uri https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip -OutFile ngrok.zip
Expand-Archive ngrok.zip -DestinationPath $env:USERPROFILE\ngrok -Force
$env:PATH += ";$env:USERPROFILE\ngrok"
ngrok config add-authtoken <你的_authtoken>
```
2. 启动预览服务（保持窗口开着）  
```powershell
cd C:\桌面\红猪数据库\prototype
npm run preview -- --host --port 4173
```
3. 新开终端启动隧道（保持窗口开着）  
```powershell
$env:PATH += ";$env:USERPROFILE\ngrok"   # 如需
ngrok http 4173
```
4. 终端会输出 `Forwarding https://xxxx.ngrok-free.dev -> http://localhost:4173`，把 https 链接发给同事即可外网访问；Ctrl+C 结束两个窗口即关闭访问。


https://virilely-uncommiserated-melania.ngrok-free.dev