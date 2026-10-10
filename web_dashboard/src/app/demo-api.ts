import type { DemoHandler } from '@anhui/web-interactions/demo'
import { entities, seriesPoints, events } from '@anhui/web-interactions/fixtures'
import { demoEntities, demoMetrics, demoOverview, demoSeries, demoForecast, demoHolidays, demoHolidayCompare } from './demo'
import type { TrendGrain } from './types'
export function dashboardDemo(scenario: string): DemoHandler {
 const ok = (data: unknown) => new Response(JSON.stringify({ data, meta: { request_id: 'demo-dashboard' } }))
 const fail = (status: number, message: string) => new Response(JSON.stringify({ error: { code: 'invalid_query', message } }), { status })
 return (url, init) => {
  const path = url.pathname.replace('/api/v1', ''), q = url.searchParams
  const body = init?.body ? JSON.parse(String(init.body)) : {}
  const grain = (q.get('grain') ?? body.grain ?? 'month') as TrendGrain
  const empty = scenario === 'empty'
  if (path === '/catalog/entities') {
   const all = [...demoEntities.filter(e => e.type === 'scenic'), ...entities.map(e => ({ ...e, longitude: demoEntities.find(d => d.id === e.id)?.longitude ?? 118.28, latitude: demoEntities.find(d => d.id === e.id)?.latitude ?? 29.82 }))]
   return ok(empty ? [] : all.filter(e => !q.get('type') || e.type === q.get('type')))
  }
  if (path === '/catalog/metrics') return ok(demoMetrics.filter(m => !q.get('entity_type') || m.supported_entity_types.includes(q.get('entity_type')!)))
  if (path === '/dashboard/overview') {
   if (!['week', 'month'].includes(grain)) return fail(422, '不支持的统计粒度')
   const result = demoOverview(grain)
   for (const card of result.cards) {
    const entity = entities.find(e => e.id === card.entity_id)
    if (entity) { card.value = grain === 'month' ? seriesPoints(entity).at(-1)!.value : null; card.status = grain === 'month' ? 'demo' : 'unsupported_grain' }
   }
   for (const point of result.map_entities) { const e = entities.find(e => e.id === point.id); if (e) { point.latest_value = seriesPoints(e).at(-1)!.value; point.available_grains = e.available_grains } }
   result.active_events_count = events.filter(e => e.status === 'active').length
   if (empty) { result.cards = []; result.map_entities = []; result.active_events_count = 0 }
   return ok(result)
  }
  if (/^\/scenic\/[^/]+\/series$/.test(path)) {
   const id = path.split('/')[2]!
   if (!demoEntities.some(e => e.id === id && e.type === 'scenic')) return fail(404, '对象不存在')
   if (!['week', 'month'].includes(grain) || q.get('metric') !== 'scenic_visits') return fail(422, '指标或粒度不匹配')
   const result = demoSeries(id, grain, q.get('start') ?? '', q.get('end') ?? '9999')
   if (empty) { result.points = []; result.coverage_ratio = 0 }
   return ok(result)
  }
  if (path === '/forecasts/history' && body.metric === 'scenic_visits') return ok(empty || scenario === 'insufficient' ? { status: 'data_insufficient', forecast_points: [], reason: '历史样本不足' } : demoForecast(body.entity_id, grain, body.training_end, body.horizon))
  if (path === '/holidays') return ok(empty ? [] : demoHolidays.filter(h => (!q.get('year') || h.year === Number(q.get('year'))) && (!q.get('kind') || h.kind === q.get('kind'))))
  if (path === '/holidays/compare') return ok(empty ? { comparable: false, reason: '暂无数据', items: [] } : demoHolidayCompare(body.holiday_ids, body.series[0].entity_id, body.mode))
  return undefined
 }
}
