export type Grain = 'day' | 'week' | 'month'
export type Metric = 'rail_departures' | 'airport_throughput'
export interface User { id: string; username: string; display_name: string; role: 'viewer' | 'admin' }
export interface Session { user: User; csrf_token: string; expires_at: string }
export interface Envelope<T> { data: T; meta: { request_id: string; page?: number; page_size?: number; total?: number } }
export interface Entity {
  id: string; name: string; type: 'rail_station' | 'airport' | 'scenic'; region_code: string
  available_metrics: string[]; available_grains: Grain[]; status: string
  longitude?: number | null; latitude?: number | null
}
export interface ComparisonResult {
  series: Array<{ entity_id: string; metric: string; points: Point[]; missing_periods: Array<{ start: string; end: string }>; source_ids: string[] }>
  comparison_note: string
}
export interface Point {
  metric: string; value: number | null; unit: string; period_start: string; period_end: string; grain: Grain
  source_ids: string[]; published_at: string; ingested_at: string; quality_status: string
  is_forecast?: boolean; model_version?: string; lower_bound?: number | null; upper_bound?: number | null
}
export interface Series { entity: Entity; metric: Metric; grain: Grain; points: Point[]; missing_periods: string[]; coverage_ratio: number; transport_type: string }
export interface Forecast {
  status: 'ready' | 'data_insufficient' | 'quality_insufficient'; forecast_points: Point[]; reason?: string
  backtest?: { method: string; mae: number; smape: number; sample_count: number }
  model_version: string; source_ids?: string[]; training_window?: { start: string; end: string }
  training_cutoff?: string; validation_error?: number
}
export interface Source { id: string; publisher: string; title: string; url: string; published_at: string; retrieved_at: string; coverage_start: string; coverage_end: string; native_grain: Grain; usage_note: string; verification_status: string }
export type Severity = 'info' | 'notice' | 'warning' | 'critical'
export interface EventItem {
  id: string; title: string; kind: string; status: 'active' | 'resolved'; authority: 'official' | 'model_signal'; severity: Severity
  affected_entity_ids: string[]; starts_at: string; ends_at: string | null; published_at: string; last_verified_at: string; source_id: string
  description?: string; source_url?: string; operator_note?: string
  timeline?: { at: string; label: string; description: string }[]
}
export interface Citation { type: 'metric' | 'document' | 'event'; id: string; title: string; url?: string; date: string; entity_id?: string }
export interface Answer {
  conversation_id: string; answer: string; status: 'answered' | 'insufficient_evidence'; citations: Citation[]
  used_metric_queries: { entity_id: string; metric: string; period_start: string; period_end: string; grain: Grain }[]; limitations: string[]
}
export interface KnowledgeDocument { title: string; publisher: string; source_url: string; published_at: string; valid_from?: string; valid_until?: string; snippets?: string[]; permission_note: string }
export interface VideoItem { id: string; scenic_id: string; camera_id: string; recorded_start_at: string; recorded_end_at: string; status: string; permission_record_id: string }
export type CountGrain = 'frame' | '5min'
export interface CountPoint {
  metric: 'camera_visible_people'; value: number | null; unit: '人'; period_start: string; period_end: string; grain: CountGrain
  source_ids: string[]; published_at: string; ingested_at: string; quality_status: string
  sample_count?: number; aggregation_rule?: 'median'
}
export interface Counts {
  metric: 'camera_visible_people'; roi: [number, number][]; points: CountPoint[]
  count_model: 'dm_count'; weights_version: string; inference_engine: 'pytorch' | 'openvino'; device: string
  openvino_version?: string; sample_interval_seconds?: number; aggregation_minutes?: number
  manual_validation: { sample_count: number; mae: number } | null
}
export interface CameraForecastPoint {
  metric: 'camera_visible_people'; value: number | null; unit: '人'; period_start: string; period_end: string; grain: '5min'
  source_ids: string[]; published_at: string; ingested_at: string; quality_status: string
  is_forecast: true; model_version: string; lower_bound?: number | null; upper_bound?: number | null
}
export interface CameraForecast {
  metric: 'camera_visible_people'; status: 'ready' | 'data_insufficient' | 'quality_insufficient'; forecast_points: CameraForecastPoint[]; reason?: string
  training_cutoff: string; input_window_minutes: number; model_version: string
  validation_error: Partial<Record<15 | 30 | 60, { mae: number; baseline_mae: number; sample_count: number; method: string }>> | null
}
