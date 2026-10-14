<script setup lang="ts">
import BigscreenTransportView from './BigscreenTransportView.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Message from 'primevue/message'
import TrendChart from '../components/TrendChart.vue'
import StatePanel from '../components/StatePanel.vue'
import SourceDrawer from '../components/SourceDrawer.vue'
import { useInteractions } from '../module'
import { errorMessage, query } from '../api/client'
import type { Entity, Forecast, Grain, Series } from '../types/api'
import { dateText, numberText } from '../utils'
const { client, options } = useInteractions()
const route = useRoute(), router = useRouter()
const entities = ref<Entity[]>([]), entityId = ref(''), grain = ref<Grain>('month')
const start = ref(options.mode === 'demo' ? '2026-01-01' : `${new Date().getFullYear()}-01-01`)
const end = ref(options.mode === 'demo' ? '2026-09-30' : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }))
const horizon = ref(3), series = ref<Series | null>(null), forecast = ref<Forecast | null>(null)
const loading = ref(true), error = ref(''), forecastError = ref(''), predicting = ref(false), sourceId = ref<string | null>(null)
const entity = computed(() => entities.value.find(e => e.id === entityId.value))
const metric = computed(() => entity.value?.type === 'airport' ? 'airport_throughput' : 'rail_departures')
const metricName = computed(() => metric.value === 'rail_departures' ? '铁路发送量' : '机场旅客吞吐量')
const grainOptions = computed(() => (entity.value?.available_grains ?? []).map(value => ({ value, label: { day: '按日', week: '按周', month: '按月' }[value] })))
const last = computed(() => series.value?.points.at(-1))
const previous = computed(() => series.value?.points.at(-2))
const change = computed(() => last.value?.value != null && previous.value?.value != null && previous.value.value !== 0 ? (last.value.value / previous.value.value - 1) * 100 : null)
let generation = 0, forecastGeneration = 0
async function loadCatalog() {
  loading.value = true; error.value = ''
  try {
    const results = await Promise.all(['rail_station', 'airport'].map(type => client.get<Entity[]>(`/catalog/entities?${query({ type, page_size: 100 })}`)))
    entities.value = [...new Map(results.flatMap(result => result.data).map(e => [e.id, e])).values()].filter(e => e.type !== 'scenic')
    entityId.value = entities.value.find(e => e.id === route.query.entity_id)?.id ?? entities.value[0]?.id ?? ''
    await loadSeries()
  } catch (e) { error.value = errorMessage(e); loading.value = false }
}
async function loadSeries() {
  const current = ++generation; ++forecastGeneration; predicting.value = false; series.value = null; forecast.value = null; error.value = ''; forecastError.value = ''
  if (!entity.value) { loading.value = false; return }
  if (!grainOptions.value.some(g => g.value === grain.value)) grain.value = grainOptions.value[0]?.value ?? 'month'
  if (!start.value || !end.value || start.value > end.value) { error.value = '请选择有效的起止日期，开始日期不能晚于结束日期'; loading.value = false; return }
  loading.value = true
  try {
    const result = await client.get<Series>(`/transport/${entityId.value}/series?${query({ metric: metric.value, grain: grain.value, start: start.value, end: end.value, quality: 'verified' })}`)
    if (current !== generation) return
    series.value = result.data
    if (grain.value !== 'day' && result.data.points.length) await predict()
  } catch (e) { if (current === generation) error.value = errorMessage(e) }
  finally { if (current === generation) loading.value = false }
}
async function predict() {
  if (!series.value?.points.length || grain.value === 'day') return
  const current = ++forecastGeneration, seriesVersion = generation
  predicting.value = true; forecastError.value = ''; forecast.value = null
  try {
    const result = await client.post<Forecast>('/forecasts/history', { entity_id: entityId.value, metric: metric.value, grain: grain.value, training_end: series.value.points.at(-1)!.period_end, horizon: horizon.value, model: 'baseline' })
    if (current === forecastGeneration && seriesVersion === generation) forecast.value = result.data
  } catch (e) { if (current === forecastGeneration) forecastError.value = errorMessage(e) }
  finally { if (current === forecastGeneration) predicting.value = false }
}
function ask() { void router.push({ name: 'b-assistant', query: { entity_id: entityId.value, question: `分析${entity.value?.name}的${metricName.value}变化趋势` } }) }
watch(() => route.query.entity_id, value => { if (typeof value === 'string' && entities.value.some(e => e.id === value)) { entityId.value = value; void loadSeries() } })
onMounted(loadCatalog)
</script>
<template>
  <BigscreenTransportView v-if="options.transportLayout !== 'standard'"
    v-model:entity-id="entityId"
    v-model:grain="grain"
    v-model:horizon="horizon"
    class="bigscreen-replacement"
    :entities="entities"
    :series="series"
    :forecast="forecast"
    :loading="loading"
    :error="error"
    :predicting="predicting"
    :forecast-error="forecastError"
    :demo="options.mode === 'demo'"
    @query="loadSeries"
    @predict="predict"
  />
  <section v-else class="b-ui page-stack transport-page">
    <header class="page-heading"><div><div class="eyebrow">TRANSPORT FLOW</div><h1>交通客流</h1><p>铁路发送量与机场旅客吞吐量分别展示，保留原始统计粒度。</p></div><Button label="问问智能助手" icon="pi pi-sparkles" severity="secondary" outlined :disabled="!entity" @click="ask" /></header>
    <form class="panel filters" @submit.prevent="loadSeries">
      <div class="field grow"><label for="entity">交通枢纽</label><Select :pt="{ overlay: { class: 'b-ui b-select-overlay' } }" input-id="entity" v-model="entityId" :options="entities" option-label="name" option-value="id" placeholder="选择交通枢纽" @change="loadSeries" /></div>
      <div class="field"><label for="grain">统计粒度</label><Select :pt="{ overlay: { class: 'b-ui b-select-overlay' } }" input-id="grain" v-model="grain" :options="grainOptions" option-label="label" option-value="value" @change="loadSeries" /></div>
      <div class="field"><label for="start">开始日期</label><input id="start" v-model="start" type="date" required /></div><span class="date-separator">—</span><div class="field"><label for="end">结束日期</label><input id="end" v-model="end" type="date" required /></div>
      <Button type="submit" label="查询" icon="pi pi-search" :loading="loading" />
    </form>
    <StatePanel v-if="loading || error" :kind="loading ? 'loading' : 'error'" :message="error" @retry="entities.length ? loadSeries() : loadCatalog()" />
    <StatePanel v-else-if="!series?.points.length" kind="empty" />
    <template v-else>
      <div class="stats-grid">
        <article class="panel stat-card"><div class="stat-top"><span>最新{{ metricName }}</span><span class="icon-tile"><i :class="['pi', entity?.type === 'airport' ? 'pi-send' : 'pi-directions']" /></span></div><div class="stat-value">{{ numberText((last?.value ?? 0) / 10000) }}<span>万人次</span></div><div class="stat-bottom"><span v-if="change != null" :class="change >= 0 ? 'positive' : 'muted'">{{ change >= 0 ? '↗' : '↘' }} {{ Math.abs(change).toFixed(1) }}%</span><span>{{ last?.period_start.slice(0, 7) }} · 较上一统计周期</span></div></article>
        <article class="panel stat-card"><div class="stat-top"><span>下一周期预测</span><span class="icon-tile lavender"><i class="pi pi-chart-line" /></span></div><div class="stat-value">{{ forecast?.status === 'ready' ? numberText((forecast.forecast_points[0]?.value ?? 0) / 10000) : '—' }}<span>万人次</span></div><div class="stat-bottom"><span class="tiny-dot lavender" />{{ forecast?.status === 'ready' ? '基线模型 · 含预测区间' : '尚无可用预测' }}</div></article>
        <article class="panel stat-card"><div class="stat-top"><span>数据覆盖率</span><span class="icon-tile"><i class="pi pi-check-circle" /></span></div><div class="stat-value">{{ numberText(series.coverage_ratio * 100) }}<span>%</span></div><div class="stat-bottom">{{ series.points.length }} 个统计周期 · {{ series.missing_periods.length }} 个缺失区间</div></article>
      </div>
      <div class="transport-grid">
        <article class="panel chart-panel"><div class="panel-heading"><div><h2>{{ entity?.name }} · 客流趋势</h2><p>{{ metricName }} / 月度来源保留原始粒度</p></div><div class="chart-legend"><span><b class="legend-line" />历史值</span><span><b class="legend-line forecast" />预测值</span><span><b class="legend-band" />预测区间</span></div></div><TrendChart :points="series.points" :forecast="forecast?.status === 'ready' ? forecast.forecast_points : []" :label="metricName" /><div class="chart-footer"><span><i class="pi pi-database" />{{ options.mode === 'demo' ? '本地演示数据 · 所有数值均为模拟' : `更新于 ${dateText(last?.ingested_at, true)}` }}</span><button class="text-link" @click="sourceId = last?.source_ids[0] ?? null">查看来源 <i class="pi pi-arrow-up-right" /></button></div></article>
        <aside class="panel forecast-panel"><span class="eyebrow">HISTORICAL FORECAST</span><h2>历史客流预测</h2><p class="muted">基于历史序列观察未来趋势，预测区间反映结果的不确定性。</p><label class="field">预测跨度<Select :pt="{ overlay: { class: 'b-ui b-select-overlay' } }" v-model="horizon" :options="[1,2,3,4,5,6].map(value => ({ value, label: `${value} ${grain === 'week' ? '周' : '个月'}` }))" option-label="label" option-value="value" aria-label="预测跨度" /></label><Button label="生成预测" icon="pi pi-chart-line" :disabled="grain === 'day'" :loading="predicting" @click="predict" /><p v-if="grain === 'day'" class="muted">历史预测仅支持周或月粒度。</p><Message v-if="forecastError" severity="error">{{ forecastError }}</Message><Message v-if="forecast && forecast.status !== 'ready'" severity="warn">{{ forecast.reason || '历史数据不足，暂不生成预测' }}</Message><div v-if="forecast?.backtest" class="model-details"><div><span>回测误差 sMAPE</span><strong>{{ forecast.backtest.smape }}%</strong></div><div><span>平均绝对误差</span><strong>{{ numberText(forecast.backtest.mae) }} 人次</strong></div><div><span>回测样本</span><strong>{{ forecast.backtest.sample_count }} 个</strong></div><div><span>模型版本</span><code>{{ forecast.model_version }}</code></div></div><span v-if="options.mode === 'demo'" class="muted small">此处模型与回测结果均为演示值。</span></aside>
      </div>
      <div class="panel definition-bar"><i class="pi pi-info-circle" /><div><strong>指标口径与统计范围</strong><p>{{ entity?.type === 'airport' ? '机场旅客吞吐量包含进出港旅客，不能与铁路发送量直接相加。' : '铁路发送量表示从车站出发的旅客人次，不包含到达量，不能视作车站总客流。' }}统计范围 {{ dateText(series.points[0]?.period_start) }} — {{ dateText(last?.period_end) }}。</p></div></div>
    </template>
    <SourceDrawer :source-id="sourceId" @close="sourceId = null" />
  </section>
</template>
