# B 问答与录像模块交接

本轮按《致B-问答与录像页面需求.md》（2026-10-15）修改。只修改本 `web_interactions/` 目录；A 的 `web_dashboard/` 与 D 的 `dpart/` 均未修改。

## A 的导入入口与依赖

- 页面与模块入口：`src/index.ts`，导出 `AssistantView`、`VideoReplayView`、`createInteractions`、`interactionRoutes`、类型及 `analysisRequest` / `readCounts` / `readForecast`。
- 样式入口：`@anhui/web-interactions/styles.css`。
- 整合站点入口：`src/host/main.ts`；共享认证与客户端：`src/host/runtime.ts`。API 使用同源 `/api/v1`、会话 Cookie 与写请求 CSRF，不在浏览器保存服务端视频路径。
- `createInteractions({ analysisIds: { [videoId]: analysisId }, analysisJobs: { [analysisId]: jobId } })` 可传入后端实际返回的标识。普通 viewer 不查询管理员作业接口；管理员可在页面填写作业编号或提交固定配置分析。任务轮询仅使用 D 已有 `GET /jobs/{job_id}`，终态、出错、切换录像或离开页面时停止。
- 依赖声明：Vue `^3.5.0`、Vue Router `^4.5.0`（peer），PrimeVue `4.5.5`、`@primeuix/themes 1.2.5`、ECharts `^6.0.0`、PrimeIcons `^7.0.0`。本次未升级依赖、未改锁文件。

## 启动与检查

整合站点（在仓库外层 `分工与项目/web_interactions` 执行）：

```powershell
pnpm --config.verifyDepsBeforeRun=false dev --host 127.0.0.1 --port 5190
```

默认使用 synthetic 演示；账号 `demo / demo2026`。真实接口模式需设置 `VITE_DATA_MODE=api`，由 Vite 将 `/api/v1` 代理到 `API_PROXY_TARGET`（默认 `http://127.0.0.1:8000`）。API 失败不会回退为演示成功。

以下命令同样在外层仓库根目录执行：

```powershell
pnpm --config.verifyDepsBeforeRun=false --filter @anhui/web-interactions typecheck
pnpm --config.verifyDepsBeforeRun=false --filter @anhui/web-interactions test
pnpm --config.verifyDepsBeforeRun=false --filter @anhui/web-interactions test:e2e
pnpm --config.verifyDepsBeforeRun=false build
```

## D 公共契约核对

已核对用户提供的 `../dpart` 本地代码提交 `a9e338e97ec8cf7f95a5defee0fceeb2a7489cd7`：`app/schemas/{videos,assistant,knowledge,jobs}.py` 与对应 `app/api/v1/` 路由。该目录当时无未提交改动。核对依据为实际 schema/路由源码，尚未取得运行中服务的 OpenAPI 和真实 HTTP 成功记录。

1. **26 请求**：`roi={points:[[x,y],...]}`，不能发送 E 内部 `{x,y}` 顶点；固定 `p2pnet` / `leader-SHTechA-50604773` / `pytorch` / `CPU`、10 秒抽帧、5 分钟聚合。不发送 `confidence_threshold`。
2. **27 响应**：模型、权重、固定 `confidence_threshold=0.5` 和审计字段在顶层；ROI 为 `{points:[[x,y],...]}`。D README 对 ROI 的简写与实际 schema 不一致，本模块按实际 schema 和路由处理。
3. **逐帧点**：使用 `recorded_at`，`period_start/end` 可为 null；映射为前端图表时间时不改原有身份与数值。5min 使用窗口起止、`sample_count`、`aggregation_rule=median`。1.5 保留小数；缺测保持 null，不累加为人次。
4. **质量和人工评估**：`good / degraded / unavailable`；未人工评估使用 null，界面显示“未人工评估”；有人工评估显示样本数及 MAE。历史 DM-Count 显式保留历史模型名称，不改写为 P2PNet。
5. **19 问答**：`used_metric_queries` 为字符串列表，不能将字符串当 `entity_id` 生成图表链接；保留 `metric_result` 与 `citations[].id/chunk_id`。兼容旧演示的具名实体查询记录时，仅使用明确返回的实体身份导航。
6. **21 文档**：片段字段为 `allowed_snippets`；有效期及索引状态从该文档身份读取，过期、未到期、有效期未知和索引未就绪分别提示。来源链接仅取接口返回的 HTTP(S) 目标，不由文件名推断。
7. **28 预测**：只提供 15/30 分钟，每 5 分钟一个未来点；校验训练截止和步距。数据/质量不足时原因加空图，不复制历史作为预测；上下界 null 时不创建阴影系列。

完整的请求及少量响应样例见 [合成 HTTP 样例](docs/p2pnet-http-synthetic.json)，所有示例均为 synthetic，不是真实录像或真实问答验收。

## 可复现演示

需通过完整页面加载切换场景，再登录演示账号：

| 页面路径 | 场景 |
|---|---|
| `/video?scenario=p2pnet` | P2PNet 合成计数、0/缺测/1.5 中位数、未人工评估 |
| `/video?scenario=p2pnet-queued-failed` | 排队 → 处理中 → 失败（约每 3 秒读取一次） |
| `/video?scenario=p2pnet-queued-not-ready` | 排队 → 处理中 → 作业完成但计数 409，保持“结果未就绪” |
| `/video?scenario=p2pnet-insufficient` | 预测不足及空图 |
| `/video?scenario=normal` | 旧 DM-Count 历史合成结果，不改名 |
| `/assistant?scenario=p2pnet` | 历史引用、文档/片段身份、过期与限制说明；问“现在有多少人”演示证据不足 |
| `/assistant?scenario=p2pnet-index` | 引用文档索引未就绪 |
| `/assistant?scenario=p2pnet-dependency` | 问答依赖不可用，无前端代答 |

## 联调状态及剩余依赖

- 页面准备、字段适配与 synthetic 场景不依赖 GPU、人工 MAE 或长预测序列。
- 本机 `127.0.0.1:8000/openapi.json` 检查为连接拒绝；未启动或修改 D 环境。实际 D 源码中 23 录像列表与 25 录像回放仍为 `pending`，不可声称真实录像 HTTP 成功。普通 HTML video 只访问 D 受保护回放地址，Range、Cookie、权限和真实流验证仍待 D 完成接口后联测。
- D 21 只返回获准片段字符串，未提供片段与 locator/页码映射；19 返回的 chunk_id 可显示，但不能推断页码或把 21 的片段顺序当引用定位。需要 D 后续发布公开定位字段。
- D 问答契约仅区分 `answered / insufficient_evidence / metric_tool_unavailable`，依赖失败为 503；未公开全局“索引未就绪”状态。B 能显示已引用文档的 pending 索引状态，但不能把所有无证据都猜成索引未就绪。
- viewer 无权读 30 作业状态；没有 D 新的公开状态接口前，viewer 使用 27 的 409 与手动重读，不能伪造排队或失败。
- 待联合验收：一次真实问答引用、真实分析排队→失败/409、受保护录像 Range、真实 P2PNet 计数读回和图表联动；人工 MAE 未提供前保留“未人工评估”。没有用 synthetic 关闭这些验收。
- 测试入口和结果见 [验证记录](docs/verification.md)。本文件供交接，未代发团队消息。
