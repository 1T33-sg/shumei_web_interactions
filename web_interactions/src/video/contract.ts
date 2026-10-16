import type { AnalysisRequest, CameraForecast, CountGrain, CountPoint, Counts, PublicCountPoint } from '../types/api'

export const p2pnet = { count_model: 'p2pnet', weights_version: 'leader-SHTechA-50604773', sample_interval_seconds: 10, aggregation_minutes: 5, inference_engine: 'pytorch', device: 'CPU' } as const
const validTime = (value: unknown): value is string => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
export function validateRoi(value: unknown): asserts value is [number, number][] {
  if (!Array.isArray(value) || value.length < 3 || value.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !finite(n) || n > 1))) throw new Error('计数接口未提供有效的归一化 ROI 多边形')
}
export function analysisRequest(roi: unknown): AnalysisRequest {
  validateRoi(roi)
  return { ...p2pnet, roi: { points: roi } }
}
// D a9e338e: ROI is {points: [x,y][]}; frame timestamps use recorded_at.
// Only the legacy DM fixture uses an array ROI and frame period_start/period_end.
export function readCounts(raw: unknown, grain: CountGrain, analysisId: string, synthetic = false): Counts {
  if (!raw || typeof raw !== 'object') throw new Error('计数接口返回格式无效')
  const data = raw as Partial<Omit<Counts, 'roi' | 'points'>> & { roi?: { points?: unknown } | unknown[] | null; grain?: unknown; points?: PublicCountPoint[] }
  const legacy = data.count_model === 'dm_count'
  if (data.metric !== 'camera_visible_people' || !Array.isArray(data.points)) throw new Error('计数接口尚未采用画面可见人数契约，请联系后端确认')
  if (!legacy && (data.count_model !== 'p2pnet' || (!synthetic && data.weights_version !== p2pnet.weights_version) || data.inference_engine !== 'pytorch' || data.device !== 'CPU' || data.confidence_threshold !== .5 || data.sample_interval_seconds !== 10)) throw new Error('P2PNet 模型、权重、固定阈值或 CPU 推理元数据不符合约定')
  if (legacy && (!data.weights_version || !data.inference_engine || !['pytorch', 'openvino'].includes(data.inference_engine) || !data.device)) throw new Error('历史 DM-Count 元数据不完整')
  if ((!legacy && data.analysis_id !== analysisId) || (data.grain != null && data.grain !== grain)) throw new Error('分析结果编号或粒度与请求不一致')
  const roi = Array.isArray(data.roi) ? legacy ? data.roi : undefined : data.roi?.points
  validateRoi(roi)
  const manual = data.manual_validation
  if (manual !== null && (!manual || !Number.isInteger(manual.sample_count) || manual.sample_count <= 0 || !finite(manual.mae))) throw new Error('人工评估结果无效；未评估应返回 null')
  const points: CountPoint[] = data.points.map(p => {
    const start = grain === 'frame' && !legacy ? p?.recorded_at : p?.period_start
    const end = grain === 'frame' && !legacy ? p?.recorded_at : p?.period_end
    if (!p || p.metric !== 'camera_visible_people' || p.unit !== '人' || p.grain !== grain || !validTime(start) || !validTime(end) || Date.parse(start) > Date.parse(end) || (p.value !== null && !finite(p.value)) || !Array.isArray(p.source_ids) || !p.source_ids.length || p.source_ids.some(id => typeof id !== 'string' || !id) || (!legacy && !['good', 'degraded', 'unavailable'].includes(p.quality_status)) || (!legacy && p.quality_status === 'unavailable' && p.value !== null) || (grain === '5min' && (p.aggregation_rule !== 'median' || !finite(p.sample_count) || !Number.isInteger(p.sample_count) || (p.sample_count === 0 && p.value !== null)))) throw new Error('计数接口的时间、质量、有效样本数或人数不符合约定')
    return { ...p, period_start: start, period_end: end, sample_count: p.sample_count ?? undefined, aggregation_rule: p.aggregation_rule === 'median' ? 'median' : undefined }
  })
  return { ...data, roi, points: points.sort((a, b) => Date.parse(a.period_end) - Date.parse(b.period_end)) } as Counts
}
export function readForecast(result: CameraForecast, cutoff: string, horizon: 15 | 30): CameraForecast {
  if (result?.metric !== 'camera_visible_people' || !['ready', 'data_insufficient', 'quality_insufficient'].includes(result.status) || !Array.isArray(result.forecast_points)) throw new Error('预测接口尚未采用画面可见人数契约，请联系后端确认')
  if (result.status !== 'ready') return { ...result, forecast_points: [] }
  if (!validTime(result.training_cutoff) || Date.parse(result.training_cutoff) !== Date.parse(cutoff) || !result.model_version || !finite(result.input_window_minutes) || result.forecast_points.length !== horizon / 5 || result.forecast_points.some((p, i) => !p || p.metric !== 'camera_visible_people' || p.unit !== '人' || p.grain !== '5min' || p.is_forecast !== true || !validTime(p.period_start) || !validTime(p.period_end) || Date.parse(p.period_start) !== Date.parse(p.period_end) || Date.parse(p.period_end) !== Date.parse(cutoff) + (i + 1) * 300000 || !finite(p.value) || [p.lower_bound, p.upper_bound].some(n => n != null && !finite(n)) || (p.lower_bound != null && p.upper_bound != null && p.lower_bound > p.upper_bound))) throw new Error('预测接口返回了不符合约定的未来人数')
  return result
}
