# 安徽文旅交通驾驶舱（整合版）

七个业务页面共用导航、登录态和 API 客户端。默认使用模拟数据，不包含真实后端、模型推理或授权录像。

## 安装与运行

需要 Node.js 20.19+（或 22.12+）、pnpm 11。只需克隆本仓库，无需另外下载同级代码。

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

访问 http://127.0.0.1:5173，点击“进入演示工作台”；也可输入演示账号 `demo` / `demo2026`。演示会话只存在内存，刷新后需要重新进入，随后返回原业务页面。

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

浏览器测试默认使用已安装的 Google Chrome。生产主应用产物在 `web_dashboard/dist/`；部署需配置 SPA 路由回退。`web_interactions` 独立演示可通过 `pnpm --filter @anhui/web-interactions dev` 启动，勿与主应用同时占用 5173。

## 模式与地图

在 `web_dashboard/.env.local` 中设置 `VITE_DATA_MODE=api` 可启用真实接口；默认 `demo`，不会根据网络状态自动切换。API 代理默认为 `http://127.0.0.1:8000`，可用 `API_PROXY_TARGET` 覆盖。真实后端尚未联调。

演示故障场景在首次打开时传入 `?scenario=empty|error|insufficient|expired|invalid|network`。分别覆盖空数据、503、预测不足、401、422、网络断开。

地图可配置 `VITE_AMAP_KEY` 和 `VITE_AMAP_SECURITY_CODE`；无配置时显示占位，其他页面可用。VITE 变量会进入浏览器构建，正式部署按地图供应商要求配置安全代理。本次不提交密钥，不验收真实地图服务。

## 目录与来源

- `web_dashboard/`：主应用、总览、景区、假期，导入自 https://github.com/MMBB-lee/web_dashboard ，提交 `8c139a90b916de030966d9000e8448404e03f9d4`。
- `web_interactions/`：交互包、认证、API 客户端、交通、事件、问答、录像；保留本仓库原提交历史。
- `tests/`：统一认证、数据契约和 Chrome 页面集成测试。

采用 pnpm workspace，本地包引用不依赖仓库外目录。所有页面均显示演示标记；问答为预设响应，视频计数与本地预览文件无关。

## A/B 前端交接与 D 端联调约定

### A 装配 B

`web_dashboard/src/app/runtime.ts` 创建唯一 `createInteractions` 实例，主入口注册插件、路由和守卫，数据层复用其 client。A 的总览、景区、假期和 B 的页面共用认证。

`InteractionOptions.resolveEntityRoute(entityId, client)` 返回 Vue Router 内部目标或 null。A 实现中分页读取 `/catalog/entities`：景区返回 `scenic?id=...`，车站/机场返回 `b-transport?entity_id=...`。事件详情和问答图表使用此入口。未知对象显示错误，不替换为默认车站。单独使用 B 时，仅解析目录中的交通对象。

### 预测区间

历史预测和录像短时预测统一使用 `forecast_points[].lower_bound`、`upper_bound`，值为 number 或 null。共享客户端兼容旧 `lower`、`upper`；新字段存在时优先，包括显式 null 和 0。缺失区间保持 null，不补造。A/B 图表均读取统一字段。

此文件明确了原接口设计稿中“上下界”未命名的字段；D 正式接口请据此确认。请求路径及训练参数保持不变。

### 录像分析结果

既有契约的 `POST /videos/{video_id}/analyses` 返回 `analysis_id`，`GET /videos/{video_id}/counts` 和短时预测均要求它。契约未定义最新分析结果查询接口，因此本次不新增或假设此类接口。

A 可在 `web_dashboard/.env.local` 配置公开标识映射（不是凭据）：

```dotenv
VITE_DATA_MODE=api
VITE_VIDEO_ANALYSIS_IDS={"40000000-0000-4000-8000-000000000001":"60000000-0000-4000-8000-000000000001"}
```

上面 UUID 仅为格式示例，应替换为 D/E 真实分析结果。修改后重启 Vite。也可在录像页输入管理员提供的分析结果编号，点击“关联分析结果”；仅保存在当前页面内存，刷新恢复配置值。切换录像时按视频 ID 独立关联。未关联不发送计数请求；409 提示尚未就绪，403/404 显示后端错误。后端仍需校验分析归属与权限，前端关联不提供授权。

真实数据尚待 D/E 提供，已用请求桩验证读取计数、409 恢复和预测链路。

### 跨景区比较

景区页新增“跨景区对比”，沿用当前时间范围和粒度，调用既有 `POST /analytics/compare`；两景区使用 `scenic_visits`、`display_mode=separate_axes`，分别绘图，不合计人次。变更筛选后清空旧比较结果。

本次为原设计稿补齐具体响应字段（D 端须按此确认）：

```ts
interface ComparisonResult {
  series: Array<{
    entity_id: string
    metric: string
    points: NumericPoint[] // 使用通用数字字段
    missing_periods: Array<{ start: string; end: string }>
    source_ids: string[]
  }>
  comparison_note: string
}
```

演示接口支持 2—4 条序列，校验对象/指标/粒度；也支持 `index_100` 和有效非零基期。当前 UI 只提供两个景区的分图比较。真实后端没有实现此接口时会明确报错，不回退样例。

### 验证

单元测试覆盖路由分页/未知对象、两代预测字段、null/0、分析映射与比较参数。浏览器测试覆盖事件/问答回到 A 景区、API 模式分析编号关联与 409 恢复、比较生成和筛选失效。测试服务使用 5183/5184，与开发预览 5173 分离。

## 联调验证记录

2026-10-10，Windows + Node.js + pnpm 11.25.0 + Google Chrome。

- 两模块 TypeScript 检查通过。
- 22 项 Vitest 测试通过：认证、CSRF 会话流程、内部跳转、统一目录、401/422/503/网络错误、空数据及预测不足。
- 20 项 Playwright 测试通过：七页登录回跳/刷新/退出，三种屏幕尺寸，地图缺配置及组件桩跳转，景区/假期筛选，事件关联跳转，问答引用，录像短时预测，登录失败及非法跳转，API 模式错误处理。
- 1920×1080、1366×768、390×844 页面无横向溢出，导航轮巡无未捕获页面异常；手机导航自身允许横向滚动。
- 独立源码副本执行冻结锁文件安装和两模块生产构建成功，不依赖原仓库依赖或外部同级源码。
- Vite 提示部分图表资源超过 500 kB，属于构建体积提示，构建成功。

### 验证边界

API 模式使用浏览器请求桩，未连接真实 FastAPI、数据库或模型。地图跳转使用组件桩，未验证真实高德服务及密钥。录像模块使用模拟计数，未运行真实检测，不附带授权视频。演示会话仅存内存，刷新后需再次进入演示。

截图和浏览器失败产物保存在本地 `test-results/`，不提交。

2026-10-10 交接缺口回归：新增景区对象路由分页与未知对象、预测字段兼容及 null/0、录像分析 ID 配置/输入/409 恢复、跨景区对比和筛选清理测试。测试端口为 5183/5184，不占用 5173 预览。详细契约见上方“A/B 前端交接与 D 端联调约定”。
