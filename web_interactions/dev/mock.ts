import type { Fetcher } from '../src/api/client'
import type { CameraForecast, CameraForecastPoint, CountPoint } from '../src/types/api'
import { chinaTime, demoAnalysisIds, demoCameraAnalyses, entities, events, seriesPoints, sourceId, videos } from './fixtures'

export type DemoHandler = (url: URL, init?: RequestInit) => Response | undefined
function isoTime(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}
function validCameraPoint(point: CountPoint): boolean {
  return point.value !== null && Number.isFinite(point.value) && point.value >= 0 && ['demo', 'verified'].includes(point.quality_status)
}
export function createDemoApi(scenario = 'normal', extra?: DemoHandler): Fetcher {
  let signedIn = false
  const ok = (data: unknown, meta = {}) => new Response(JSON.stringify({ data, meta: { request_id: 'demo-request', ...meta } }), { status: 200 })
  const fail = (status: number, code: string, message: string) => new Response(JSON.stringify({ error: { code, message, details: {} }, request_id: 'demo-request' }), { status })
  const session = () => ({ user: { id: 'demo-user', username: 'demo', display_name: '演示访客', role: 'viewer' }, csrf_token: 'demo-csrf', expires_at: '2099-01-01T00:00:00+08:00' })
  return async (input, init) => {
    await new Promise(resolve => setTimeout(resolve, 160))
    const url = new URL(input, 'http://demo.invalid')
    const path = url.pathname.replace('/api/v1', '')
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    if (path === '/auth/login') {
      if (body.username !== 'demo' || body.password !== 'demo2026') return fail(401, 'invalid_credentials', '演示账号为 demo / demo2026，也可以点击下方演示按钮')
      signedIn = true; return ok(session())
    }
    if (!signedIn) return fail(401, 'unauthorized', '请先登录')
    if (init?.method === 'POST' && new Headers(init.headers).get('X-CSRF-Token') !== 'demo-csrf') return fail(403, 'invalid_csrf', '会话校验失败')
    if (path === '/auth/me') return ok(session())
    if (path === '/auth/logout') { signedIn = false; return ok({ logged_out: true }) }
    if (scenario === 'error') return fail(503, 'demo_unavailable', '演示故障场景：服务暂时不可用')
    if (scenario === 'network') throw new Error('模拟网络断开')
    if (scenario === 'expired') return fail(401, 'expired', '会话已失效')
    if (scenario === 'invalid') return fail(422, 'invalid_query', '查询参数无效')
    const extended = extra?.(url, init)
    if (extended) return extended
    if (path === '/catalog/entities') return ok(entities, { total: entities.length, page: 1, page_size: 100 })
    if (path.startsWith('/sources/')) return ok({ id: sourceId, publisher: '本地演示数据集', title: '交通客流界面演示数据', url: '', published_at: '2026-10-08T09:00:00+08:00', retrieved_at: '2026-10-08T10:00:00+08:00', coverage_start: '2026-01-01', coverage_end: '2026-09-30', native_grain: 'month', usage_note: '所有数值均为人工构造，仅用于界面和交互验证，不能用于研究结论或出行决策。', verification_status: 'demo' })
    if (/^\/transport\/[^/]+\/series$/.test(path)) {
      const entity = entities.find(item => item.id === path.split('/')[2])
      if (!entity) return fail(404, 'not_found', '对象不存在')
      if (!entity.available_grains.includes(url.searchParams.get('grain') as 'month')) return fail(422, 'unsupported_grain', '演示数据仅支持月度，不拆分为日或周数据')
      if (url.searchParams.get('metric') !== entity.available_metrics[0]) return fail(422, 'metric_entity_mismatch', '指标不匹配')
      const points = scenario === 'empty' ? [] : seriesPoints(entity).filter(p => p.period_start >= (url.searchParams.get('start') || '') && p.period_end <= (url.searchParams.get('end') || '9999'))
      return ok({ entity, metric: entity.available_metrics[0], grain: 'month', points, missing_periods: [], coverage_ratio: points.length ? 1 : 0, transport_type: entity.type })
    }
    if (path === '/forecasts/history') {
      const entity = entities.find(item => item.id === body.entity_id)!
      if (scenario === 'insufficient' || scenario === 'empty') return ok({ status: 'data_insufficient', forecast_points: [], model_version: 'demo-baseline', reason: '可用历史样本不足，无法生成可信预测' })
      const all = seriesPoints(entity).filter(p => p.period_end <= body.training_end)
      const last = all.at(-1)
      if (!last) return ok({ status: 'data_insufficient', forecast_points: [], model_version: 'demo-baseline', reason: '所选训练截止时间前没有数据' })
      const forecast_points = Array.from({ length: body.horizon }, (_, i) => {
        const start = new Date(`${last.period_start}T00:00:00Z`); start.setUTCMonth(start.getUTCMonth() + i + 1)
        const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0)
        const value = Math.round(last.value! * (1.035 + i * .017))
        return { ...last, period_start: start.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10), value, lower_bound: Math.round(value * .9), upper_bound: Math.round(value * 1.1), is_forecast: true, model_version: 'demo-baseline' }
      })
      return ok({ status: 'ready', forecast_points, model_version: 'demo-baseline', backtest: { method: '演示回测（模拟结果）', mae: 68500, smape: 4.8, sample_count: 6 }, training_window: { start: all[0]!.period_start, end: last.period_end }, source_ids: [sourceId] })
    }
    if (path === '/events') {
      const filtered = scenario === 'empty' ? [] : events.filter(event => ['region_code', 'status', 'authority'].every(key => !url.searchParams.get(key) || (key === 'region_code' && url.searchParams.get(key) === '340000') || event[key as 'status'] === url.searchParams.get(key)))
      const page = Number(url.searchParams.get('page') || 1), size = Number(url.searchParams.get('page_size') || 20)
      return ok(filtered.slice((page - 1) * size, page * size), { total: filtered.length, page, page_size: size })
    }
    if (path.startsWith('/events/')) return ok(events.find(event => event.id === path.split('/')[2]))
    if (path === '/assistant/chat') {
      const hasEvidence = scenario !== 'insufficient' && /合肥|铁路|机场|交通|趋势/.test(body.message) && !/实时|现在|今日|今天|明天/.test(body.message)
      return ok({ conversation_id: body.conversation_id || '70000000-0000-4000-8000-000000000001', status: hasEvidence ? 'answered' : 'insufficient_evidence',
        answer: hasEvidence ? '在这组演示数据中，合肥南站 2026 年 9 月发送量为 154.8 万人次，较 8 月的 184 万人次有所回落。\n\n这里统计的是铁路发送人次，与机场旅客吞吐量的口径不同。建议分别观察各自趋势，不直接相加。\n\n以上内容为预设演示回答，未调用真实模型或业务数据库。' : '当前资料不足以回答这个问题。演示数据只覆盖部分对象的月度数据，无法确认实时情况或其他未覆盖事实。请缩小到合肥南站的月度交通趋势，或待接入真实资料后再查询。',
        citations: hasEvidence ? [{ type: 'metric', id: sourceId, title: '合肥南站 · 月度发送量（演示）', entity_id: entities[0]!.id, date: '2026-09-30' }] : [], used_metric_queries: hasEvidence ? [{ entity_id: entities[0]!.id, metric: 'rail_departures', period_start: '2026-01-01', period_end: '2026-09-30', grain: 'month' }] : [], limitations: ['本地预设回答，仅用于交互演示', '演示数据不能作为实际出行依据'],
      })
    }
    if (path === '/videos') {
      const filtered = scenario === 'empty' ? [] : videos.filter(video => ['scenic_id', 'camera_id', 'status'].every(key => !url.searchParams.get(key) || video[key as 'scenic_id'] === url.searchParams.get(key)))
      return ok(filtered, { total: filtered.length, page: 1, page_size: 100 })
    }
    if (/^\/videos\/[^/]+\/(?:counts|short-forecast)$/.test(path)) {
      const video = videos.find(item => item.id === path.split('/')[2])
      if (!video) return fail(404, 'not_found', '录像不存在')
      const requestedAnalysis = path.endsWith('/counts') ? url.searchParams.get('analysis_id') : body.analysis_id
      if (typeof requestedAnalysis !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestedAnalysis)) return fail(400, 'invalid_analysis_id', '请提供有效的分析结果编号')
      if (requestedAnalysis !== demoAnalysisIds[video.id]) return fail(409, 'analysis_not_ready', '该录像的分析结果尚未就绪')
      const dataset = demoCameraAnalyses[requestedAnalysis]!
      if (path.endsWith('/counts')) {
        const grain = url.searchParams.get('grain') ?? '5min'
        if (grain !== 'frame' && grain !== '5min') return fail(422, 'unsupported_grain', '录像画面人数仅支持 frame 或 5min 粒度')
        const start = url.searchParams.has('start') ? isoTime(url.searchParams.get('start')) : Number.NEGATIVE_INFINITY
        const end = url.searchParams.has('end') ? isoTime(url.searchParams.get('end')) : Number.POSITIVE_INFINITY
        if (start === null || end === null || start > end) return fail(400, 'invalid_time_range', '请提供有效的录制时间范围，且开始时间不能晚于结束时间')
        const points = scenario === 'empty' ? [] : (grain === 'frame' ? dataset.frames : dataset.analysis.points).filter(point => Date.parse(point.period_start) >= start && Date.parse(point.period_end) <= end)
        return ok({ ...dataset.analysis, points })
      }
      if (Object.prototype.hasOwnProperty.call(body, 'direction')) return fail(422, 'unsupported_direction', '画面人数预测不接受进入或离开方向参数')
      if (![15, 30, 60].includes(body.horizon_minutes)) return fail(422, 'unsupported_horizon', '预测跨度只能为 15、30 或 60 分钟')
      if (body.step_minutes !== 5) return fail(422, 'unsupported_step', '首版画面人数预测固定每 5 分钟一步')
      const cutoff = isoTime(body.cutoff_at)
      if (cutoff === null || cutoff < Date.parse(video.recorded_start_at) || cutoff > Date.parse(video.recorded_end_at)) return fail(400, 'invalid_cutoff', '预测截止时间必须是录制片段内的 ISO 时间')
      const inputMinutes = body.horizon_minutes === 15 ? 60 : body.horizon_minutes === 30 ? 120 : 0
      const base: CameraForecast = {
        metric: 'camera_visible_people', status: 'data_insufficient', forecast_points: [], training_cutoff: body.cutoff_at,
        input_window_minutes: inputMinutes, model_version: 'demo-damped-trend-simulated-v1', validation_error: null,
      }
      if (body.horizon_minutes === 60) return ok({ ...base, reason: '模拟样本仅有 3 小时单日记录，缺少同摄像头多天数据及 60 分钟时间顺序回测，暂不开放该跨度' })
      const history = scenario === 'empty' ? [] : dataset.analysis.points.filter(point => Date.parse(point.period_end) <= cutoff)
      if (scenario === 'insufficient' || history.length === 0) return ok({ ...base, reason: `模拟场景：截止位置前需要约 ${inputMinutes} 分钟有效画面人数，当前历史不足` })
      if (history.slice(-2).some(point => !validCameraPoint(point))) return ok({ ...base, status: 'quality_insufficient', reason: '模拟质量门槛：最近两个窗口存在缺失或遮挡，暂停预测；缺失值未补零' })
      if (cutoff - Date.parse(video.recorded_start_at) < inputMinutes * 60000) return ok({ ...base, reason: `模拟起步门槛：未来 ${body.horizon_minutes} 分钟预测需要截止位置前约 ${inputMinutes} 分钟历史` })
      const window = history.filter(point => Date.parse(point.period_start) >= cutoff - inputMinutes * 60000)
      const valid = window.filter(validCameraPoint)
      // The demo permits a small historical gap while requiring recent complete windows; no missing value is imputed.
      if (valid.length / (inputMinutes / 5) < .9) return ok({ ...base, status: 'quality_insufficient', reason: '模拟质量门槛：输入窗口有效计数覆盖率不足 90%，暂停预测；缺失和遮挡数据未参与拟合' })
      const recent = valid.slice(-6), last = recent.at(-1)!
      const trend = (last.value! - recent[0]!.value!) / Math.max(1, recent.length - 1)
      const forecast_points: CameraForecastPoint[] = Array.from({ length: body.horizon_minutes / 5 }, (_, i) => {
        const at = chinaTime(cutoff + (i + 1) * 300000)
        const value = Math.max(0, Math.round(last.value! + trend * (1 - Math.pow(.8, i + 1)) / .2))
        return {
          metric: 'camera_visible_people', value, unit: '人', grain: '5min', period_start: at, period_end: at,
          source_ids: last.source_ids, published_at: body.cutoff_at, ingested_at: body.cutoff_at, quality_status: 'demo',
          is_forecast: true, model_version: base.model_version, lower_bound: Math.max(0, Math.round(value * .85)), upper_bound: Math.round(value * 1.15),
        }
      })
      return ok({ ...base, status: 'ready', forecast_points, validation_error: { [body.horizon_minutes]: {
        mae: body.horizon_minutes === 15 ? 4.2 : 6.4, baseline_mae: body.horizon_minutes === 15 ? 5.1 : 7.8,
        sample_count: body.horizon_minutes === 15 ? 18 : 12, method: '模拟时间顺序回测结果；未执行真实模型训练或准确率验证',
      } } })
    }
    return fail(404, 'not_available', '演示环境未提供此资源')
  }
}
