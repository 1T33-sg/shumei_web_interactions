import { markRaw } from 'vue'
import { createInteractions } from '../module'
import { createDemoApi } from '../../dev/mock'
import { analysisId, videos } from '../../dev/fixtures'
import AnhuiMap from '../../../web_dashboard/src/components/map/AnhuiMap.vue'
import { resolveEntityRoute, parseAnalysisIds } from './integration'
import { dashboardDemo } from './demo-api'
import { syntheticJobIds } from '../../dev/synthetic'
export const dataMode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo'
const scenario = new URLSearchParams(location.search).get('scenario') ?? 'p2pnet'
let analysisIds: Record<string, string> = {}
export let integrationConfigError = ''
if (dataMode === 'api') {
  try { analysisIds = parseAnalysisIds(import.meta.env.VITE_VIDEO_ANALYSIS_IDS) }
  catch (error) { integrationConfigError = error instanceof Error ? error.message : '录像分析配置无效' }
}
export const interactions = createInteractions({
  mode: dataMode, defaultRedirect: '/', allowedRedirects: ['/', '/scenic', '/holidays', '/transport', '/events', '/assistant', '/video'],
  transportLayout: 'standard', resolveEntityRoute,
  transportMap: markRaw(AnhuiMap),
  analysisIds,
  ...(dataMode === 'demo' && scenario.startsWith('p2pnet') ? { analysisJobs: syntheticJobIds } : {}),
  ...(dataMode === 'demo' ? { fetcher: createDemoApi(scenario, dashboardDemo(scenario)), analysisIds: { [videos[0]!.id]: analysisId }, cameraNames: { 'demo-east-gate': '黄山 · 演示东入口' } } : {}),
  regions: [{ label: '合肥市', value: '340100' }, { label: '黄山市', value: '341000' }],
})
