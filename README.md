# 安徽文旅交通驾驶舱（整合版）

七个业务页面共用导航、登录态和 API 客户端。默认使用模拟数据，不包含真实后端、模型推理或授权录像。

## 当前职责与上游版本

`web_dashboard/` 完整同步自 [MMBB-lee/web_dashboard](https://github.com/MMBB-lee/web_dashboard/commit/e00af3428eb263b4a4e8e282d5a7b469d55d328c)，固定提交为 `e00af3428eb263b4a4e8e282d5a7b469d55d328c`。57 个上游文件保持原样，校验记录位于 `upstream-dashboard.json`，单元测试按 Git 的 LF 文本换行规范逐文件检查一致性，兼容 Windows 的 CRLF 工作区。

A 的入口、总览、景区、假期和地图均以上游为准。整合站点从仓库根目录运行 `pnpm dev`：根 `vite.config.ts` 只在整合构建中接入 B 的 `web_interactions/src/host/`，负责统一会话、演示/API 模式、接口客户端及地点跳转。A 目录自身仍保留上游的独立运行方式。

B 的交通页通过 `transportMap` 选项复用 A 的地图组件，提供五个演示交通枢纽、地图点选与筛选器联动；真实接口继续使用返回的经纬度。原有的录像分析编号、409 重试、问答与事件跳转适配保存在 B 侧。景区和假期页面的界面与数据样例跟随上述 A 版本；下面较早日期的交接记录用于保留历史背景。

2026-10-15 本次同步验收：32 项单元测试、6 项 A 地图专项检查和 37 个浏览器场景通过。浏览器先执行全站回归，再针对会话过期提示及新版假期选择流程复查；同时复查了七页登录回跳、刷新与退出。1920、1366、390 三种宽度的页面检查通过，已人工检查交通地图截图。两模块类型检查和整合版生产构建通过，仍有既有图表资源体积提示。API 场景使用请求桩，不代表真实后端或模型已联调。

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

总览和交通页共用上述 A 版本的 Three.js 立体行政区地图，无需高德 Key。地图使用随前端发布的 `web_dashboard/public/geo/anhui-boundaries.json`，包含 16 个地级市、104 个区县及完整边界，来源与精度说明见同目录的 `README.md`。

支持滚轮缩放、拖拽旋转、右键平移、俯视/立体切换和返回全省；地级市、区县和全部地名可分别切换。景区、铁路站、机场沿用整合版原有坐标与详情跳转，动态连线表示当前景区与铁路站、机场的关联示意，不代表实际出行轨迹。保留演示模式的静态样例标记。运行 `pnpm --filter web-dashboard test:map` 可检查地图挂载、更新、卸载、边界加载重试及完整几何投影。

## 目录与来源

- `web_dashboard/`：A 的完整上游源码，导入自 https://github.com/MMBB-lee/web_dashboard ，提交 `e00af3428eb263b4a4e8e282d5a7b469d55d328c`。
- `web_interactions/`：交互包、认证、API 客户端、交通、事件、问答、录像；保留本仓库原提交历史。
- `tests/`：统一认证、数据契约和 Chrome 页面集成测试。

采用 pnpm workspace，本地包引用不依赖仓库外目录。所有页面均显示演示标记；问答为预设响应，视频计数与本地预览文件无关。

## A/B 前端交接与 D 端联调约定

### B 页面视觉适配（2026-10-12）

以同级 `../web_dashboard` 已拉取的 `31ef154`（完善客流总览、景区与假期展示）为视觉模板，统一交通、事件、问答、录像及登录控件的深蓝底色、青色强调、直角卡片、角标边框、标题字号和紧凑间距。历史图用青色实线，预测用橙色虚线；数据、接口、单位、预测区间及指标口径不变。

本次只改 B 仓库中的 `web_interactions/src/` 和验证/交接文件，不更新内置的 `web_dashboard/` 副本，不包含采集更新工具。

A 沿用唯一应用入口与 `@anhui/web-interactions/styles.css` 导入，正式交通页继续设置 `transportLayout: 'standard'`。独立演示保留原来的大屏预览；验收正式样式使用仓库根目录的 `pnpm dev`。无新增应用入口、路由或公共组件。

B 样式限定在 `.b-ui`，直接读取 A 已有的 `--bg-main`、`--bg-panel`、`--border-glow`、`--text-title`、`--text-main`、`--text-sub`、`--accent`、`--accent-warn` 等变量；未提供时使用对应模板默认值。下拉浮层显式带 `.b-ui.b-select-overlay`，详情抽屉沿用 `.b-ui.b-drawer`，不覆盖全局控件。后续提取跨模块公共组件或更改 A 的变量规范，需先与 A 对齐。

验证记录：B 类型检查、两个模块生产构建、22 项单元测试、20 项既有浏览器回归及 4 项新增视觉/浮层检查通过（新增检查修正测试定位后复测）。1920×1080、1366×768、390×844 的四个 B 页面无横向溢出，卡片背景、边框和圆角与宿主一致；已人工检查截图。构建仍有图表资源超过 500 kB 的体积提示。浏览器使用演示数据和 API 请求桩，未新增真实后端联调。

执行 `pnpm test:e2e tests/e2e/visual-consistency.spec.ts` 可复现新增检查；本次 12 张验收截图保存在忽略目录 `playwright-report/b-visual-review/`。

### B 录像画面人数更新（2026-10-14）

按 `../更新说明/` 中 B 的验收要求和视频接口 27—28 更新现有页面。录像计数使用 `camera_visible_people`，单位为“人”；移除旧进出方向、`entries/exits` 和累计人次。侧栏显示截止位置前最近帧或完整窗口的估计人数，5 分钟点为有效帧中位数，不把连续帧人数相加。

录像页支持逐帧 / 5 分钟切换，显示录制起止时间、固定 ROI、质量状态、有效抽样帧数、DM-Count 权重、实际推理引擎及设备、人工核验 MAE。ROI 图是归一化区域示意，不冒充录像截图；仅在引擎为 `openvino` 时显示其版本。计数为青色实线，未来人数为橙色虚线，可用区间单独显示。短时图使用真实时间轴，保留 10 秒抽帧和 5 分钟预测之间的时间比例；零人数与缺失分别显示 `0` 和“缺失”。

预测请求仅包含 `analysis_id`、`cutoff_at`、`horizon_minutes`、`step_minutes=5`，复用登录 Cookie 和 CSRF 校验。切换录像、粒度、时长或截止位置会清空旧预测；409 `analysis_not_ready` 保留回放和关联表单供重试，`data_insufficient` / `quality_insufficient` 均不绘制预测曲线。服务错误不会回退模拟人数，旧计数响应和无效 ROI / 人数会明确报错。

演示包含密集和稀疏两段人工构造的 3 小时样例、零人数、缺失和遮挡窗口，以及明确标记的模拟核验 / 回测误差。默认截止 2 小时、预测 30 分钟；15 / 30 分钟分别以约 60 / 120 分钟历史为起步门槛，并执行模拟质量判断，60 分钟因没有同机位多天数据及有效回测而返回不足。模拟门槛与误差仅用于交互检查，不是模型性能或真实数据验收结果。选择本地视频仅供本机播放，不上传，演示计数、ROI 和时间轴与文件无关联。

新设计稿未固定以下 JSON 内部结构，本次将 B 类型及模拟接口具体化为下列格式，供 D/E 联调确认；未新增 HTTP 路由：

- `Counts.roi`：归一化 `[x, y][]` 多边形，至少三个点。
- 分析元数据位于计数响应顶层：`count_model`、`weights_version`、`inference_engine`、`device`、可选 `openvino_version`。可选 `sample_interval_seconds` 未返回时展示“接口未提供”，不假定实际抽帧间隔。
- 计数点沿用通用数字字段 `period_start` / `period_end` / `value` 等；`grain=5min` 时还要求 `sample_count` 和 `aggregation_rule=median`。逐帧点可不带聚合字段。
- 预测使用独立 `CameraForecast` 类型，保留 `training_cutoff`、`input_window_minutes`、`model_version`；`validation_error` 为按 `15/30/60` 分钟索引的对象或 `null`，各项包含 `mae`、`baseline_mae`、`sample_count`、`method`。无回测结果保持 `null`，不补造。
- 预测点使用通用数字字段、`grain=5min`、`is_forecast=true`，时间表示未来时间点；示例中 `period_start=period_end`。区间沿用已有 `lower_bound` / `upper_bound`。

保留原有分析编号配置与手动输入，不假设 `/videos` 返回分析编号。新增演示样例的编号和名称仅在 B 的演示模式加载，无需修改 A 入口。未修改 A/C/D/E 的代码；真实 FastAPI、授权录像、DM-Count 计数及回测仍待 D/E 联调。

本次改动文件（保留此前已有视觉适配修改）：

- 页面与图表：`web_interactions/src/video/VideoReplayView.vue`、`web_interactions/src/components/TrendChart.vue`、`web_interactions/src/styles.css`。
- 类型与演示：`web_interactions/src/types/api.ts`、`web_interactions/dev/App.vue`、`web_interactions/dev/fixtures.ts`、`web_interactions/dev/mock.ts`。
- 测试：`tests/unit/video-contract.test.ts`、`tests/e2e/video-counts.spec.ts`、`tests/e2e/handoff.spec.ts`、`tests/e2e/dashboard.spec.ts`。
- 交接说明：`README.md`。

2026-10-14 验证：B 类型检查、两个前端模块生产构建、31 项单元测试、31 项 Chrome 浏览器测试通过；桌面和手机截图人工检查完成，无横向溢出或页面异常。浏览器测试使用演示数据与 API 请求桩，覆盖 409 重试、粒度失败恢复、无效 ROI、负预测值拒绝及不足状态无预测曲线。截图在忽略目录 `test-results/video-counts-1920.png` 和 `test-results/video-counts-390.png`。测试服务退出阶段在本机未自动结束，关闭本次测试创建的进程后，测试命令正常返回成功；构建仍有既有图表资源体积提示。

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

### 比较接口兼容

B 的 `host/demo-api.ts` 保留既有 `POST /analytics/compare` 适配；景区页面按 A 上游版本展示。比较请求使用各自的指标和 `display_mode=separate_axes`，不合计不同指标的人次。

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

演示接口支持 2—4 条序列，校验对象/指标/粒度；也支持 `index_100` 和有效非零基期。真实后端没有实现此接口时会明确报错，不回退样例。

### 验证

单元测试覆盖上游文件一致性、路由分页/未知对象、两代预测字段、null/0、分析映射与比较参数。浏览器测试覆盖事件/问答回到 A 景区、API 模式分析编号关联与 409 恢复，以及 B 交通地图与筛选联动。测试服务使用 5183/5184，与开发预览 5173 分离。

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
