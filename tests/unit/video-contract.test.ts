import { describe, expect, it } from 'vitest'
import { createApiClient, query } from '../../web_interactions/src/api/client'
import { createDemoApi } from '../../web_interactions/dev/mock'
import { chinaTime, demoAnalysisIds, demoCameraAnalyses, videos } from '../../web_interactions/dev/fixtures'
import type { CameraForecast, Counts, VideoItem } from '../../web_interactions/src/types/api'

const video = videos[0]!
async function client(scenario = 'normal') {
  const api = createApiClient({ fetcher: createDemoApi(scenario), csrf: () => 'demo-csrf', unauthorized: () => {} })
  await api.post('/auth/login', { username: 'demo', password: 'demo2026' })
  return api
}
function forecastBody(minutes = 120, horizon = 30, item: VideoItem = video) {
  return { analysis_id: demoAnalysisIds[item.id], cutoff_at: chinaTime(Date.parse(item.recorded_start_at) + minutes * 60000), horizon_minutes: horizon, step_minutes: 5 }
}
const forecastPath = `/videos/${video.id}/short-forecast`

describe('recorded camera-visible people contract', () => {
  it('preserves the first identity and provides dense and sparse examples with zero and missing values', async () => {
    const api = await client()
    const list = (await api.get<VideoItem[]>('/videos')).data
    expect(list).toHaveLength(2)
    expect(list[0]!.id).toBe('40000000-0000-4000-8000-000000000001')
    expect(demoAnalysisIds[list[0]!.id]).toBe('60000000-0000-4000-8000-000000000001')
    const results = await Promise.all(list.map(item => api.get<Counts>(`/videos/${item.id}/counts?${query({ analysis_id: demoAnalysisIds[item.id] })}`)))
    for (const { data } of results) {
      expect(data).toMatchObject({ metric: 'camera_visible_people', count_model: 'dm_count', sample_interval_seconds: 10, aggregation_minutes: 5, manual_validation: { sample_count: 12 } })
      expect(data.manual_validation!.mae).toBeGreaterThan(0)
      expect(data.weights_version).toContain('simulated')
      expect(data.device).toContain('模拟')
      expect(data).not.toHaveProperty('openvino_version')
      expect(data.roi.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true)
      expect(data.points[0]).toMatchObject({ value: 0, quality_status: 'demo', sample_count: 30 })
      expect(data.points[1]).toMatchObject({ value: null, quality_status: 'missing', sample_count: 0 })
      expect(data.points[21]).toMatchObject({ value: null, quality_status: 'occluded' })
      for (const point of data.points) {
        expect(point).toMatchObject({ metric: 'camera_visible_people', unit: '人', grain: '5min', aggregation_rule: 'median' })
        expect(point.source_ids.length).toBeGreaterThan(0)
        expect(point.published_at).toBeTruthy()
        expect(point.ingested_at).toBeTruthy()
        expect(point).not.toHaveProperty('entries')
        expect(point).not.toHaveProperty('exits')
        expect(point).not.toHaveProperty('window_start')
      }
    }
    expect(results[0]!.data.points[2]!.value).toBeGreaterThan(results[1]!.data.points[2]!.value!)
    expect(results[0]!.data.manual_validation!.mae).not.toBe(results[1]!.data.manual_validation!.mae)
  })

  it('supports frame points and time-range filtering without aggregating frames into person trips', async () => {
    const api = await client()
    const analysis_id = demoAnalysisIds[video.id]!
    const range = { analysis_id, start: '2026-09-28T09:10:00+08:00', end: '2026-09-28T09:20:00+08:00' }
    const aggregate = (await api.get<Counts>(`/videos/${video.id}/counts?${query(range)}`)).data
    expect(aggregate.points).toHaveLength(2)
    expect(aggregate.points[0]!.period_start).toBe(range.start)
    expect(aggregate.points[1]!.period_end).toBe(range.end)
    const frames = (await api.get<Counts>(`/videos/${video.id}/counts?${query({ ...range, grain: 'frame' })}`)).data
    expect(frames.points).toHaveLength(61)
    expect(frames.points[0]).toMatchObject({ grain: 'frame', unit: '人', period_start: range.start, period_end: range.start })
    expect(frames.points[0]).not.toHaveProperty('aggregation_rule')
    expect(frames.points[0]).not.toHaveProperty('sample_count')
    expect(Date.parse(frames.points[1]!.period_start) - Date.parse(frames.points[0]!.period_start)).toBe(10000)
  })

  it('matches each analysis to its video and rejects unsupported count queries', async () => {
    const api = await client()
    const cases: [string, number][] = [
      [`/videos/unknown/counts?analysis_id=${demoAnalysisIds[video.id]}`, 404],
      [`/videos/${video.id}/counts?analysis_id=${demoAnalysisIds[videos[1]!.id]}`, 409],
      [`/videos/${video.id}/counts`, 400],
      [`/videos/${video.id}/counts?${query({ analysis_id: demoAnalysisIds[video.id], grain: 'day' })}`, 422],
      [`/videos/${video.id}/counts?${query({ analysis_id: demoAnalysisIds[video.id], start: 'invalid' })}`, 400],
      [`/videos/${video.id}/counts?${query({ analysis_id: demoAnalysisIds[video.id], start: '2026-09-28T10:00:00+08:00', end: video.recorded_start_at })}`, 400],
    ]
    for (const [path, status] of cases) await expect(api.get(path)).rejects.toMatchObject({ status })
  })

  it('validates forecast identity, cutoff, horizon, step and obsolete direction', async () => {
    const api = await client()
    const valid = forecastBody()
    const cases: [Record<string, unknown>, number][] = [
      [{ analysis_id: demoAnalysisIds[videos[1]!.id] }, 409],
      [{ analysis_id: '' }, 400],
      [{ cutoff_at: '2026-09-28T08:59:59+08:00' }, 400],
      [{ cutoff_at: '2026-09-28T12:00:01+08:00' }, 400],
      [{ cutoff_at: '2026-09-28' }, 400],
      [{ horizon_minutes: 20 }, 422],
      [{ horizon_minutes: '30' }, 422],
      [{ step_minutes: 1 }, 422],
      [{ direction: 'entries' }, 422],
    ]
    for (const [change, status] of cases) await expect(api.post(forecastPath, { ...valid, ...change })).rejects.toMatchObject({ status })
    await expect(api.post('/videos/unknown/short-forecast', valid)).rejects.toMatchObject({ status: 404 })
  })

  it('requires the history for each horizon and returns explicit empty results for bad quality or unavailable long-horizon validation', async () => {
    const api = await client()
    const cases: [number, number, CameraForecast['status']][] = [
      [30, 15, 'data_insufficient'], [60, 15, 'ready'], [60, 30, 'data_insufficient'],
      [115, 30, 'quality_insufficient'], [120, 30, 'ready'], [120, 60, 'data_insufficient'],
    ]
    for (const [minutes, horizon, status] of cases) {
      const result = (await api.post<CameraForecast>(forecastPath, forecastBody(minutes, horizon))).data
      expect(result.status).toBe(status)
      expect(result.metric).toBe('camera_visible_people')
      if (status === 'ready') {
        expect(result.forecast_points).toHaveLength(horizon / 5)
        expect(result.input_window_minutes).toBe(horizon === 15 ? 60 : 120)
        expect(result.validation_error?.[horizon as 15 | 30]?.method).toContain('模拟')
        expect(result.validation_error?.[horizon as 15 | 30]?.baseline_mae).toBeGreaterThan(0)
        expect(result.forecast_points.every(point => point.metric === 'camera_visible_people' && point.unit === '人' && point.grain === '5min' && point.is_forecast)).toBe(true)
        expect(result.forecast_points[0]!.period_start).toBe(chinaTime(Date.parse(result.training_cutoff) + 300000))
      } else {
        expect(result.forecast_points).toEqual([])
        expect(result.validation_error).toBeNull()
        expect(result.reason).toBeTruthy()
      }
    }
  })

  it.each(['empty', 'insufficient'])('keeps %s demo forecast results empty', async scenario => {
    const api = await client(scenario)
    const result = (await api.post<CameraForecast>(forecastPath, forecastBody())).data
    expect(result).toMatchObject({ status: 'data_insufficient', forecast_points: [], validation_error: null })
    if (scenario === 'empty') expect((await api.get<Counts>(`/videos/${video.id}/counts?analysis_id=${demoAnalysisIds[video.id]}`)).data.points).toEqual([])
  })

  it('does not leak counts after the cutoff into fitting or reported error', async () => {
    const api = await client()
    const body = forecastBody(60, 15)
    const before = (await api.post<CameraForecast>(forecastPath, body)).data
    const points = demoCameraAnalyses[body.analysis_id!]!.analysis.points
    const future = points.filter(point => Date.parse(point.period_end) > Date.parse(body.cutoff_at))
    const saved = future.map(point => ({ value: point.value, quality_status: point.quality_status }))
    try {
      for (const point of future) { point.value = 1000000; point.quality_status = 'verified' }
      const after = (await api.post<CameraForecast>(forecastPath, body)).data
      expect(after).toEqual(before)
    } finally {
      future.forEach((point, i) => Object.assign(point, saved[i]))
    }
  })

  it('treats zero as a valid visible-people estimate in forecast input', async () => {
    const api = await client()
    const body = forecastBody(60, 15)
    const history = demoCameraAnalyses[body.analysis_id!]!.analysis.points.filter(point => Date.parse(point.period_end) <= Date.parse(body.cutoff_at))
    const saved = history.map(point => ({ value: point.value, quality_status: point.quality_status }))
    try {
      for (const point of history) { point.value = 0; point.quality_status = 'demo' }
      const result = (await api.post<CameraForecast>(forecastPath, body)).data
      expect(result.status).toBe('ready')
      expect(result.forecast_points.every(point => point.value === 0 && point.lower_bound === 0 && point.upper_bound === 0)).toBe(true)
    } finally {
      history.forEach((point, i) => Object.assign(point, saved[i]))
    }
  })
})
