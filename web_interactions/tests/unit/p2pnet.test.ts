import { describe, expect, it } from 'vitest'
import { analysisRequest, readCounts, readForecast } from '../../src/video/contract'
import { readAnswer, evidenceState, assistantError } from '../../src/assistant/evidence'
import { ApiError } from '../../src/api/client'
import { syntheticCounts, syntheticDocument } from '../../dev/synthetic'
import { analysisId, demoCameraAnalyses, videos } from '../../dev/fixtures'
import type { CameraForecast } from '../../src/types/api'

const wire = () => ({ ...syntheticCounts(), weights_version: 'leader-SHTechA-50604773' })
const cutoff = '2026-09-28T11:00:00+08:00'
const forecast = (): CameraForecast => ({ metric: 'camera_visible_people', status: 'ready', forecast_points: Array.from({ length: 3 }, (_, i) => {
  const at = new Date(Date.parse(cutoff) + (i + 1) * 300000).toISOString()
  return { metric: 'camera_visible_people', unit: '人', value: 1.5, grain: '5min', period_start: at, period_end: at, source_ids: [], published_at: cutoff, ingested_at: cutoff, quality_status: 'good', is_forecast: true, lower_bound: null, upper_bound: null }
}), training_cutoff: cutoff, model_version: 'test-model', input_window_minutes: 120, validation_error: null })
describe('D a9e338e P2PNet public contract', () => {
  it('uses the public ROI pairs and omits the response-only fixed threshold from requests', () => {
    expect(analysisRequest([[0, 0], [1, 0], [1, 1]])).toEqual({ count_model: 'p2pnet', weights_version: 'leader-SHTechA-50604773', roi: { points: [[0, 0], [1, 0], [1, 1]] }, sample_interval_seconds: 10, aggregation_minutes: 5, inference_engine: 'pytorch', device: 'CPU' })
    expect(() => analysisRequest([{ x: 0, y: 0 }])).toThrow()
  })
  it('preserves decimal medians, zeros, missing values and unassessed status', () => {
    const value = readCounts(wire(), '5min', analysisId)
    expect(value.points[23]!.value).toBe(1.5)
    expect(value.points[0]!.value).toBe(0)
    expect(value.points[1]).toMatchObject({ value: null, sample_count: 0, quality_status: 'unavailable', aggregation_rule: 'median' })
    expect(value.manual_validation).toBeNull()
    expect(value.roi).toEqual(wire().roi.points)
  })
  it('reads frame recorded_at instead of nullable period fields', () => {
    const value = readCounts({ ...syntheticCounts(videos[0]!.id, 'frame'), weights_version: 'leader-SHTechA-50604773' }, 'frame', analysisId)
    expect(value.points[0]!.period_end).toBe('2026-09-28T09:00:00+08:00')
    expect(Date.parse(value.points[1]!.period_end) - Date.parse(value.points[0]!.period_end)).toBe(10000)
  })
  it.each([{ confidence_threshold: .4 }, { device: 'GPU' }, { inference_engine: 'openvino' }, { weights_version: 'other' }, { analysis_id: 'wrong' }, { roi: { points: [{ x: 0, y: 0 }] } }, { manual_validation: { sample_count: 0, mae: 0 } }])('rejects mismatched public metadata %j', patch => {
    expect(() => readCounts({ ...wire(), ...patch }, '5min', analysisId)).toThrow()
  })
  it('rejects zero substitution and invalid sample counts', () => {
    for (const patch of [{ value: 0, quality_status: 'unavailable' }, { value: 1, sample_count: 0 }, { sample_count: -1 }, { quality_status: 'ok' }, { aggregation_rule: 'sum' }]) {
      const data = wire(); Object.assign(data.points[1]!, patch)
      expect(() => readCounts(data, '5min', analysisId)).toThrow()
    }
  })
  it('retains the historical DM identity', () => {
    expect(readCounts(demoCameraAnalyses[analysisId]!.analysis, '5min', analysisId).count_model).toBe('dm_count')
  })
  it('leaves insufficient forecasts empty even when future points were returned', () => {
    expect(readForecast({ ...forecast(), status: 'data_insufficient', reason: '不足' }, cutoff, 15).forecast_points).toEqual([])
  })
  it('preserves nullable bands, and rejects reused history or wrong 5-minute steps', () => {
    expect(readForecast(forecast(), cutoff, 15).forecast_points[0]!.lower_bound).toBeNull()
    const data = forecast(); data.forecast_points[0]!.period_end = cutoff
    expect(() => readForecast(data, cutoff, 15)).toThrow()
    expect(() => readForecast(forecast(), cutoff, 30)).toThrow()
  })
})
describe('public evidence identities and dates', () => {
  it('preserves opaque chunk identity and string query records without deriving routes', () => {
    const raw = { conversation_id: 'opaque', answer: '来自接口的回答', status: 'answered', used_metric_queries: ['opaque-query'], citations: [{ type: 'document', id: 'document-id', chunk_id: 'opaque-chunk', title: '历史资料', url: null, date: null }], limitations: [] }
    expect(readAnswer(raw)).toEqual(raw)
    expect(() => readAnswer({ ...raw, citations: [{ title: 'file.pdf' }] })).toThrow()
  })
  it('distinguishes expired, pending index, not-yet-effective and unknown validity', () => {
    expect(evidenceState(syntheticDocument, Date.parse('2026-10-15'))).toContain('历史资料')
    expect(evidenceState({ ...syntheticDocument, index_status: 'pending' })).toContain('索引未就绪')
    expect(evidenceState({ ...syntheticDocument, valid_until: null, valid_from: '2099-01-01' })).toContain('尚未到')
    expect(evidenceState({ ...syntheticDocument, valid_until: null })).toContain('未提供')
  })
  it('distinguishes dependency failure and access denial without fabricating answers', () => {
    expect(assistantError(new ApiError(503, 'dependency_not_available', 'private details'))).toContain('依赖不可用')
    expect(assistantError(new ApiError(403, 'forbidden', 'private details'))).toContain('无权')
    expect(assistantError(new ApiError(401, 'unauthorized', 'private details'))).toContain('登录已失效')
  })
})
