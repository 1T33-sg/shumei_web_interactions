import { demoAnalysisIds, demoCameraAnalyses, videos } from './fixtures'
import type { DemoHandler } from './mock'

export const syntheticJobIds = Object.fromEntries(Object.values(demoAnalysisIds).map((id, i) => [id, `80000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`]))
export const syntheticDocumentId = '90000000-0000-4000-8000-000000000001'
export const syntheticChunkId = 'synthetic-chunk-opaque-identity'
export const syntheticDocument = {
  id: syntheticDocumentId, title: 'synthetic · 历史运营公告', publisher: '合成演示资料', source_url: '',
  published_at: '2025-09-01T09:00:00+08:00', valid_from: '2025-09-01', valid_until: '2025-09-30', index_status: 'ready',
  allowed_snippets: ['synthetic：该历史公告仅适用于 2025 年 9 月，不能证明当前开放时间或人数。'], permission_note: '人工构造的测试文本，不是实际公告。',
}
export function syntheticCounts(videoId = videos[0]!.id, grain: 'frame' | '5min' = '5min') {
  const id = demoAnalysisIds[videoId]!, dataset = demoCameraAnalyses[id]!
  const frames = dataset.frames.map((point, i) => ({
    ...point, value: Math.floor(i / 30) === 23 ? i % 30 < 15 ? 1 : 2 : point.value,
    recorded_at: point.period_end, period_start: null, period_end: null,
    quality_status: point.value === null ? 'unavailable' : Math.floor(i / 30) === 22 ? 'degraded' : 'good',
    source_ids: ['synthetic-fixture'], published_at: null, ingested_at: null, sample_count: 1, aggregation_rule: null,
  }))
  const points = dataset.analysis.points.map((point, i) => ({
    ...point, value: i === 23 ? 1.5 : point.value, recorded_at: null,
    quality_status: point.value === null ? 'unavailable' : i === 22 ? 'degraded' : 'good',
    source_ids: ['synthetic-fixture'], published_at: null, ingested_at: null,
  }))
  return { analysis_id: id, metric: 'camera_visible_people', grain, roi: { points: dataset.analysis.roi }, points: grain === 'frame' ? frames : points,
    count_model: 'p2pnet', weights_version: 'synthetic-points-only', confidence_threshold: .5, inference_engine: 'pytorch', device: 'CPU',
    sample_interval_seconds: 10, manual_validation: null, weights_sha256: null, model_source_revision: 'synthetic-not-a-real-model-run' }
}
export function createSyntheticHandler(scenario: string): DemoHandler | undefined {
  if (!scenario.startsWith('p2pnet')) return
  const reads = new Map<string, number>()
  const queued = scenario.includes('queued')
  const ok = (data: unknown) => new Response(JSON.stringify({ data, meta: { request_id: 'synthetic-request' } }), { status: 200 })
  const fail = (status: number, code: string, message: string) => new Response(JSON.stringify({ error: { code, message, details: {} }, request_id: 'synthetic-request' }), { status })
  return (url, init) => {
    const path = url.pathname.replace('/api/v1', '')
    if (path === '/assistant/chat') {
      const body = JSON.parse(String(init?.body ?? '{}'))
      if (scenario.includes('dependency')) return fail(503, 'dependency_not_available', 'synthetic 依赖不可用')
      const insufficient = /现在|实时|缺乏|无证据/.test(body.message)
      return ok({ conversation_id: body.conversation_id || '70000000-0000-4000-8000-000000000001', status: insufficient ? 'insufficient_evidence' : 'answered',
        answer: insufficient ? 'synthetic：没有证据确认当前人数，不能提供当前数值。' : 'synthetic：检索到一份已结束适用期的历史公告，仅供追溯，不能据此确认当前情况。',
        citations: insufficient ? [] : [{ type: 'document', id: syntheticDocumentId, chunk_id: syntheticChunkId, title: syntheticDocument.title, date: syntheticDocument.published_at, url: null }],
        used_metric_queries: [], metric_result: null, limitations: ['synthetic 合成问答，未连接真实知识库', '历史公告不代表当前事实'],
      })
    }
    if (path === `/knowledge/documents/${syntheticDocumentId}`) return ok({ ...syntheticDocument, ...(scenario.includes('index') ? { index_status: 'pending', allowed_snippets: [] } : {}) })
    const jobId = path.match(/^\/jobs\/([^/]+)$/)?.[1]
    if (jobId) {
      const analysis_id = Object.keys(syntheticJobIds).find(id => syntheticJobIds[id] === jobId)
      if (!analysis_id) return fail(404, 'not_found', 'synthetic 作业不存在')
      const count = (reads.get(jobId) ?? 0) + 1; reads.set(jobId, count)
      const status = !queued ? 'succeeded' : count === 1 ? 'queued' : count === 2 ? 'running' : scenario.includes('failed') ? 'failed' : 'succeeded'
      return ok({ id: jobId, type: 'video_analysis', analysis_id, status, started_at: null, finished_at: null, processed_count: null, imported_count: null, error_summary: status === 'failed' ? 'synthetic：模拟文件不可用' : null })
    }
    const match = path.match(/^\/videos\/([^/]+)\/(counts|short-forecast|analyses)$/)
    if (!match) return
    const videoId = match[1]!, endpoint = match[2]!, body = JSON.parse(String(init?.body ?? '{}'))
    if (!videos.some(video => video.id === videoId)) return fail(404, 'not_found', 'synthetic 录像不存在')
    if (endpoint === 'analyses') {
      if ('confidence_threshold' in body || body.count_model !== 'p2pnet' || body.weights_version !== 'leader-SHTechA-50604773' || body.device !== 'CPU' || body.inference_engine !== 'pytorch' || !Array.isArray(body.roi?.points)) return fail(422, 'unsupported', 'synthetic：不符合 D 26 请求契约')
      return ok({ video_id: videoId, analysis_id: demoAnalysisIds[videoId], job_id: syntheticJobIds[demoAnalysisIds[videoId]!], status: 'queued', count_metric: 'camera_visible_people', inference_engine: 'pytorch' })
    }
    const analysisId = endpoint === 'counts' ? url.searchParams.get('analysis_id') : body.analysis_id
    if (analysisId !== demoAnalysisIds[videoId]) return fail(404, 'not_found', 'synthetic 分析与录像不匹配')
    if (queued) return fail(409, 'analysis_not_ready', 'synthetic：分析结果未就绪')
    if (endpoint === 'counts') return ok(syntheticCounts(videoId, url.searchParams.get('grain') === 'frame' ? 'frame' : '5min'))
    const insufficient = scenario.includes('insufficient') || Date.parse(body.cutoff_at) < Date.parse(videos[0]!.recorded_start_at) + 120 * 60000
    return ok({ metric: 'camera_visible_people', status: insufficient ? 'data_insufficient' : 'ready', forecast_points: insufficient ? [] : Array.from({ length: body.horizon_minutes / 5 }, (_, i) => {
      const at = new Date(Date.parse(body.cutoff_at) + (i + 1) * 300000).toISOString()
      return { metric: 'camera_visible_people', unit: '人', grain: '5min', value: 1.5 + (i + 1) * .5, period_start: at, period_end: at, is_forecast: true, lower_bound: null, upper_bound: null }
    }), training_cutoff: body.cutoff_at, input_window_minutes: 120, model_version: 'synthetic-forecast-not-trained', validation_error: null, reason: insufficient ? 'synthetic：有效历史不足，未生成预测。' : null })
  }
}
