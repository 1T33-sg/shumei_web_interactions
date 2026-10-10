import { createInteractions } from '@anhui/web-interactions'
import { createDemoApi } from '@anhui/web-interactions/demo'
import { analysisId, videos } from '@anhui/web-interactions/fixtures'
import { dashboardDemo } from './demo-api'
export const dataMode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo'
const scenario = new URLSearchParams(location.search).get('scenario') ?? 'normal'
export const interactions = createInteractions({
  mode: dataMode, defaultRedirect: '/', allowedRedirects: ['/', '/scenic', '/holidays', '/transport', '/events', '/assistant', '/video'],
  transportLayout: 'standard',
  ...(dataMode === 'demo' ? { fetcher: createDemoApi(scenario, dashboardDemo(scenario)), analysisIds: { [videos[0]!.id]: analysisId }, cameraNames: { 'demo-east-gate': '黄山 · 演示东入口' } } : {}),
  regions: [{ label: '合肥市', value: '340100' }, { label: '黄山市', value: '341000' }],
})
