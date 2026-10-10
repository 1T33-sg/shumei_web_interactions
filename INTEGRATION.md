# A/B 前端交接与 D 端联调约定

## A 装配 B

`web_dashboard/src/app/runtime.ts` 创建唯一 `createInteractions` 实例，主入口注册插件、路由和守卫，数据层复用其 client。A 的总览、景区、假期和 B 的页面共用认证。

`InteractionOptions.resolveEntityRoute(entityId, client)` 返回 Vue Router 内部目标或 null。A 实现中分页读取 `/catalog/entities`：景区返回 `scenic?id=...`，车站/机场返回 `b-transport?entity_id=...`。事件详情和问答图表使用此入口。未知对象显示错误，不替换为默认车站。单独使用 B 时，仅解析目录中的交通对象。

## 预测区间

历史预测和录像短时预测统一使用 `forecast_points[].lower_bound`、`upper_bound`，值为 number 或 null。共享客户端兼容旧 `lower`、`upper`；新字段存在时优先，包括显式 null 和 0。缺失区间保持 null，不补造。A/B 图表均读取统一字段。

此文件明确了原接口设计稿中“上下界”未命名的字段；D 正式接口请据此确认。请求路径及训练参数保持不变。

## 录像分析结果

既有契约的 `POST /videos/{video_id}/analyses` 返回 `analysis_id`，`GET /videos/{video_id}/counts` 和短时预测均要求它。契约未定义最新分析结果查询接口，因此本次不新增或假设此类接口。

A 可在 `web_dashboard/.env.local` 配置公开标识映射（不是凭据）：

```dotenv
VITE_DATA_MODE=api
VITE_VIDEO_ANALYSIS_IDS={"40000000-0000-4000-8000-000000000001":"60000000-0000-4000-8000-000000000001"}
```

上面 UUID 仅为格式示例，应替换为 D/E 真实分析结果。修改后重启 Vite。也可在录像页输入管理员提供的分析结果编号，点击“关联分析结果”；仅保存在当前页面内存，刷新恢复配置值。切换录像时按视频 ID 独立关联。未关联不发送计数请求；409 提示尚未就绪，403/404 显示后端错误。后端仍需校验分析归属与权限，前端关联不提供授权。

真实数据尚待 D/E 提供，已用请求桩验证读取计数、409 恢复和预测链路。

## 跨景区比较

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

## 验证

单元测试覆盖路由分页/未知对象、两代预测字段、null/0、分析映射与比较参数。浏览器测试覆盖事件/问答回到 A 景区、API 模式分析编号关联与 409 恢复、比较生成和筛选失效。测试服务使用 5183/5184，与开发预览 5173 分离。
