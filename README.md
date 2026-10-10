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

A/B 对象跳转、预测区间兼容、录像分析结果关联和跨景区比较的详细契约见 [INTEGRATION.md](./INTEGRATION.md)。
