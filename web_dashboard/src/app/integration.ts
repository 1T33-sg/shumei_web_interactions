import type { RouteLocationRaw } from 'vue-router'
import type { Entity, Interactions } from '@anhui/web-interactions'
export async function resolveEntityRoute(id: string, client: Interactions['client']): Promise<RouteLocationRaw | null> {
 for (let page = 1; ; page++) {
  const result = await client.get<Entity[]>(`/catalog/entities?page=${page}&page_size=100`)
  const entity = result.data.find(item => item.id === id)
  if (entity) return entity.type === 'scenic' ? { name: 'scenic', query: { id } } : { name: 'b-transport', query: { entity_id: id } }
  if (result.data.length < 100 || (result.meta.total !== undefined && page * 100 >= result.meta.total)) return null
 }
}
export function parseAnalysisIds(value?: string): Record<string, string> {
 if (!value) return {}
 const data: unknown = JSON.parse(value)
 if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('VITE_VIDEO_ANALYSIS_IDS 必须是录像 ID 到分析 ID 的 JSON 对象')
 const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 for (const [video, analysis] of Object.entries(data)) {
  if (!uuid.test(video) || typeof analysis !== 'string' || !uuid.test(analysis)) throw new Error('录像与分析 ID 必须使用后端返回的 UUID')
 }
 return data as Record<string, string>
}
