import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import { createInteractions } from '../src/module'
import { interactionRoutes } from '../src/routes'
import { interactionTheme } from '../src/theme'
import { createDemoApi } from './mock'
import { analysisId, videos } from './fixtures'
import App from './BigscreenApp.vue'
import 'primeicons/primeicons.css'
import '../src/styles.css'
import './shell.css'
import './bigscreen-shell.css'

const mode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo'
const module = createInteractions({
  mode,
  ...(mode === 'demo' ? { fetcher: createDemoApi(new URLSearchParams(location.search).get('scenario') ?? 'normal'), analysisIds: { [videos[0]!.id]: analysisId }, cameraNames: { 'demo-east-gate': '黄山 · 演示东入口' } } : {}),
  regions: [{ label: '合肥市', value: '340100' }, { label: '黄山市', value: '341000' }],
})
const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', redirect: '/transport' }, ...interactionRoutes, { path: '/:pathMatch(.*)*', redirect: '/transport' }] })
module.installGuard(router)
createApp(App).use(PrimeVue, { theme: { preset: interactionTheme, options: { darkModeSelector: '.app-dark' } }, locale: { emptyMessage: '暂无结果', emptySearchMessage: '未找到匹配结果', searchMessage: '{0} 个可用结果', selectionMessage: '{0} 个选项已选择' } }).use(module).use(router).mount('#app')
