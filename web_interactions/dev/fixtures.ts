import type { Entity, EventItem, Point, VideoItem, CountPoint } from '../src/types/api'
export const entities: Entity[] = [
  { id: '10000000-0000-4000-8000-000000000001', name: '合肥南站', type: 'rail_station', region_code: '340100', available_metrics: ['rail_departures'], available_grains: ['month'], status: 'available' },
  { id: '10000000-0000-4000-8000-000000000002', name: '黄山北站', type: 'rail_station', region_code: '341000', available_metrics: ['rail_departures'], available_grains: ['month'], status: 'available' },
  { id: '10000000-0000-4000-8000-000000000003', name: '合肥新桥机场', type: 'airport', region_code: '340100', available_metrics: ['airport_throughput'], available_grains: ['month'], status: 'available' },
]
export const sourceId = '20000000-0000-4000-8000-000000000001'
export function seriesPoints(entity: Entity): Point[] {
  const values = entity.type === 'airport' ? [76, 84, 79, 83, 91, 87, 98, 106, 93] : entity.name === '黄山北站' ? [28, 39, 32, 43, 48, 42, 56, 61, 49] : [118, 143, 126, 139, 152, 144, 172, 184, 154.8]
  return values.map((value, i) => ({
    metric: entity.available_metrics[0]!, value: value * 10000, unit: '人次', period_start: `2026-${String(i + 1).padStart(2, '0')}-01`,
    period_end: `2026-${String(i + 1).padStart(2, '0')}-${new Date(2026, i + 1, 0).getDate()}`, grain: 'month',
    source_ids: [sourceId], published_at: '2026-10-08T09:00:00+08:00', ingested_at: '2026-10-08T10:00:00+08:00', quality_status: 'demo',
  }))
}
export const events: (EventItem & { region_code: string })[] = [
  { id: '30000000-0000-4000-8000-000000000001', title: '黄山景区部分游步道临时维护', kind: 'scenic_closure', status: 'active', authority: 'official', severity: 'notice', region_code: '341000', affected_entity_ids: [entities[1]!.id], starts_at: '2026-10-09T08:00:00+08:00', ends_at: '2026-10-15T18:00:00+08:00', published_at: '2026-10-08T16:00:00+08:00', last_verified_at: '2026-10-09T08:00:00+08:00', source_id: sourceId, description: '这是一条模拟公告，用于演示事件详情。部分游步道维护期间，请查看入口指引与开放范围。该内容不能作为出行依据。', source_url: '', timeline: [{ at: '2026-10-08T16:00:00+08:00', label: '公告发布', description: '演示来源发布维护说明' }, { at: '2026-10-09T08:00:00+08:00', label: '开始生效', description: '部分路段进入维护状态' }] },
  { id: '30000000-0000-4000-8000-000000000002', title: '合肥南站发送量波动提示', kind: 'rail_adjustment', status: 'active', authority: 'model_signal', severity: 'warning', region_code: '340100', affected_entity_ids: [entities[0]!.id], starts_at: '2026-10-09T09:00:00+08:00', ends_at: '2026-10-15T23:59:00+08:00', published_at: '2026-10-09T09:00:00+08:00', last_verified_at: '2026-10-09T09:00:00+08:00', source_id: sourceId, description: '模拟规则发现月度发送量变化，仅用于展示模型提示。模型提示不是官方预警，也不能用于判断车站实时拥挤程度。', timeline: [{ at: '2026-10-09T09:00:00+08:00', label: '模型提示生成', description: '演示规则 demo-signal-v1' }] },
  { id: '30000000-0000-4000-8000-000000000003', title: '合肥新桥机场航班调整通知', kind: 'flight_adjustment', status: 'resolved', authority: 'official', severity: 'info', region_code: '340100', affected_entity_ids: [entities[2]!.id], starts_at: '2026-09-28T08:00:00+08:00', ends_at: '2026-09-28T18:00:00+08:00', published_at: '2026-09-27T16:00:00+08:00', last_verified_at: '2026-09-28T18:00:00+08:00', source_id: sourceId, description: '模拟航班调整公告，已解除。保留时间线用于说明历史公告与当前有效状态的区别。', timeline: [{ at: '2026-09-27T16:00:00+08:00', label: '公告发布', description: '模拟时刻调整' }, { at: '2026-09-28T18:00:00+08:00', label: '影响解除', description: '演示调整已结束' }] },
]
export const videos: VideoItem[] = [{ id: '40000000-0000-4000-8000-000000000001', scenic_id: '00000000-0000-4000-8000-000000000001', camera_id: 'demo-east-gate', recorded_start_at: '2026-09-28T09:00:00+08:00', recorded_end_at: '2026-09-28T12:00:00+08:00', status: 'ready', permission_record_id: 'demo-no-video-file' }]
export const analysisId = '60000000-0000-4000-8000-000000000001'
export function chinaTime(time: number) { return new Date(time + 8 * 3600000).toISOString().slice(0, 19) + '+08:00' }
export const counts: CountPoint[] = Array.from({ length: 36 }, (_, i) => ({
  window_start: chinaTime(Date.parse(videos[0]!.recorded_start_at) + i * 300000), window_end: chinaTime(Date.parse(videos[0]!.recorded_start_at) + (i + 1) * 300000),
  entries: Math.round(18 + 12 * Math.sin(i / 6) + i / 3), exits: Math.round(9 + 4 * Math.cos(i / 4) + i / 4), quality_status: i === 21 ? 'occluded' : 'demo', detector_model_version: 'demo-detector', openvino_version: '演示占位', device: '未执行推理',
}))
