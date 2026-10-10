<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import StatePanel from '../components/StatePanel.vue'
import TrendChart from '../components/TrendChart.vue'
import { useInteractions } from '../module'
import { errorMessage, query } from '../api/client'
import type { Counts, Forecast, Point, VideoItem } from '../types/api'
import { dateText, numberText } from '../utils'
const { client, options } = useInteractions()
const selectedAnalysisIds = ref<Record<string, string>>({ ...options.analysisIds })
const analysisInput = ref(''), analysisInputError = ref('')
const videos = ref<VideoItem[]>([]), videoId = ref(''), counts = ref<Counts | null>(null), forecast = ref<Forecast | null>(null)
const loading = ref(true), error = ref(''), forecastError = ref(''), predicting = ref(false)
const position = ref(3600), direction = ref<'entries' | 'exits'>('entries'), horizon = ref(30)
const player = ref<HTMLVideoElement>(), localUrl = ref(''), fileInput = ref<HTMLInputElement>(), playbackError = ref('')
const video = computed(() => videos.value.find(v => v.id === videoId.value))
const duration = computed(() => video.value ? (Date.parse(video.value.recorded_end_at) - Date.parse(video.value.recorded_start_at)) / 1000 : 0)
const cutoff = computed(() => video.value ? chinaTime(Date.parse(video.value.recorded_start_at) + position.value * 1000) : '')
const completeCounts = computed(() => counts.value?.points.filter(p => Date.parse(p.window_end) <= Date.parse(cutoff.value)) ?? [])
const totals = computed(() => completeCounts.value.reduce((sum, p) => ({ entries: sum.entries + p.entries, exits: sum.exits + p.exits }), { entries: 0, exits: 0 }))
const historyPoints = computed<Point[]>(() => completeCounts.value.map(p => ({ metric: direction.value === 'entries' ? 'camera_entries' : 'camera_exits', value: p[direction.value], unit: '人次', period_start: p.window_start, period_end: p.window_end, grain: 'day', source_ids: [], published_at: p.window_end, ingested_at: p.window_end, quality_status: p.quality_status })))
const playbackSrc = computed(() => options.mode === 'demo' ? localUrl.value : video.value ? `/api/v1/videos/${encodeURIComponent(video.value.id)}/playback` : '')
let generation = 0, forecastVersion = 0
function chinaTime(time: number) { return new Date(time + 8 * 3600000).toISOString().slice(0, 19) + '+08:00' }
function positionLabel(seconds: number) { return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(Math.floor(seconds) % 60).padStart(2, '0')}` }
async function loadVideos() {
  loading.value = true; error.value = ''
  try { videos.value = (await client.get<VideoItem[]>('/videos?page_size=100')).data; videoId.value = videos.value[0]?.id ?? ''; await loadCounts() }
  catch (e) { error.value = errorMessage(e); loading.value = false }
}
async function loadCounts() {
  const current = ++generation; ++forecastVersion; counts.value = null; forecast.value = null; forecastError.value = ''; predicting.value = false; error.value = ''; playbackError.value = ''; loading.value = true
  position.value = Math.min(3600, duration.value)
  analysisInput.value = selectedAnalysisIds.value[videoId.value] ?? ''; analysisInputError.value = ''
  const analysisId = selectedAnalysisIds.value[videoId.value]
  if (!analysisId) { loading.value = false; return }
  try { const response = await client.get<Counts>(`/videos/${videoId.value}/counts?${query({ analysis_id: analysisId })}`); if (current === generation) counts.value = response.data }
  catch (e) { if (current === generation) error.value = errorMessage(e) }
  finally { if (current === generation) loading.value = false }
}
async function associateAnalysis() {
  const id = analysisInput.value.trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { analysisInputError.value = '请输入有效的分析结果编号（UUID）'; return }
  selectedAnalysisIds.value[videoId.value] = id
  await loadCounts()
}
function seek() { if (player.value && playbackSrc.value && Number.isFinite(player.value.duration)) player.value.currentTime = Math.min(position.value, player.value.duration) }
function updateTime() { if (player.value) position.value = Math.min(player.value.currentTime, duration.value) }
async function predict() {
  const analysisId = selectedAnalysisIds.value[videoId.value]
  if (!analysisId) return
  player.value?.pause()
  const current = ++forecastVersion; forecast.value = null; forecastError.value = ''; predicting.value = true
  try {
    const response = await client.post<Forecast>(`/videos/${videoId.value}/short-forecast`, { analysis_id: analysisId, cutoff_at: cutoff.value, horizon_minutes: horizon.value, step_minutes: 5, direction: direction.value })
    if (current === forecastVersion) forecast.value = response.data
  } catch (e) { if (current === forecastVersion) forecastError.value = errorMessage(e) }
  finally { if (current === forecastVersion) predicting.value = false }
}
function localPreview(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('video/')) { playbackError.value = '请选择浏览器可播放的视频文件'; return }
  if (localUrl.value) URL.revokeObjectURL(localUrl.value)
  localUrl.value = URL.createObjectURL(file); playbackError.value = ''
}
watch([direction, horizon, position], () => { ++forecastVersion; forecast.value = null; forecastError.value = ''; predicting.value = false })
onMounted(loadVideos)
onBeforeUnmount(() => { if (localUrl.value) URL.revokeObjectURL(localUrl.value) })
</script>
<template>
  <section class="b-ui page-stack">
    <header class="page-heading"><div><div class="eyebrow">RECORDED VIDEO ANALYSIS</div><h1>录像回放<span class="heading-dot">.</span></h1><p>沿时间轴回看入口通行，理解短时客流变化。</p></div><Tag value="录像回放 · 非实时" severity="warn" /></header>
    <div class="panel filters"><label class="field grow">录像片段<Select v-model="videoId" :options="videos.map(v => ({ value: v.id, label: `${options.cameraNames?.[v.camera_id] || v.camera_id} · ${dateText(v.recorded_start_at)}` }))" option-label="label" option-value="value" aria-label="录像片段" @change="loadCounts" /></label><div class="recording-meta"><span>录制时间</span><strong>{{ dateText(video?.recorded_start_at, true) }} — {{ video?.recorded_end_at.slice(11,16) || '—' }}</strong></div></div>
    <form v-if="options.mode === 'api' && video" class="panel filters" @submit.prevent="associateAnalysis">
      <label class="field grow">分析结果编号<input v-model="analysisInput" aria-label="分析结果编号" placeholder="填写该录像已完成的分析结果编号" /></label>
      <Button type="submit" label="关联分析结果" :disabled="loading" />
      <p v-if="analysisInputError" role="alert">{{ analysisInputError }}</p>
      <p class="muted small">由管理员提供对应录像的分析结果编号；服务器负责校验访问权限和录像归属。</p>
    </form>
    <StatePanel v-if="loading || error" :kind="loading ? 'loading' : 'error'" :message="error" @retry="videos.length ? loadCounts() : loadVideos()" />
    <StatePanel v-else-if="!video" kind="empty" message="暂无获准回放的录像。待上传并授权后可查看。" />
    <template v-else>
      <div class="video-grid"><article class="panel replay-panel"><div class="panel-heading"><h2>{{ options.cameraNames?.[video.camera_id] || video.camera_id }}</h2><span class="small muted"><i class="pi pi-video" /> 录像回放</span></div>
        <video v-if="playbackSrc" ref="player" :key="playbackSrc" :src="playbackSrc" controls preload="metadata" class="video-player" @timeupdate="updateTime" @error="playbackError = '录像暂时无法播放，请检查文件格式、会话或访问授权'" />
        <div v-else class="video-placeholder"><div class="gate-blueprint" aria-hidden="true"><span /><span /><span /><i class="pi pi-video" /></div><h3>授权录像待接入</h3><p>当前展示入口计数与时间轴的交互演示</p><Button v-if="options.mode === 'demo'" label="选择本地录像预览" icon="pi pi-folder-open" severity="secondary" outlined @click="fileInput?.click()" /><input ref="fileInput" type="file" accept="video/*" class="sr-only" aria-label="选择本地录像" @change="localPreview" /><span class="small muted">文件仅在本机播放，不上传；演示计数与该文件无关联</span></div>
        <Message v-if="playbackError" severity="error">{{ playbackError }}</Message>
        <div class="replay-timeline"><label for="replay-position"><span>回放位置</span><strong>{{ positionLabel(position) }} <span class="muted">/ {{ positionLabel(duration) }}</span></strong></label><input id="replay-position" v-model.number="position" type="range" min="0" :max="duration" step="1" @input="seek" /><div><span>{{ video.recorded_start_at.slice(11,16) }}</span><span>{{ cutoff.slice(11,19) }} · 统计截止位置</span><span>{{ video.recorded_end_at.slice(11,16) }}</span></div></div>
      </article><aside class="panel counter-panel"><span class="eyebrow">GATE COUNTS</span><h2>入口估计通行人数</h2><p class="muted small">从录像开始至当前完整统计窗口</p><div class="count-item"><span><i class="pi pi-arrow-down-left" />进入</span><strong>{{ counts ? numberText(totals.entries) : '—' }}<small>人次</small></strong></div><div class="count-item"><span><i class="pi pi-arrow-up-right" />离开</span><strong>{{ counts ? numberText(totals.exits) : '—' }}<small>人次</small></strong></div><div class="model-details"><div><span>统计窗口</span><strong>{{ completeCounts.length }} 个</strong></div><div><span>计数质量</span><strong>{{ options.mode === 'demo' ? '模拟数据' : completeCounts.some(p => p.quality_status !== 'verified') ? '含待核验窗口' : completeCounts.length ? '已核验' : '待分析' }}</strong></div><div><span>人工校准</span><strong>{{ counts?.manual_validation ? `MAE ${counts.manual_validation.mae}` : '尚无校准记录' }}</strong></div></div><p class="notice">单入口通行人次不能推导全景区在园人数。</p></aside></div>
      <Message v-if="!counts" severity="warn">暂未关联可读取的分析结果，计数与短时预测将在分析完成后提供。</Message>
      <article v-else class="panel"><div class="panel-heading"><div><h2>入口通行趋势与短时预测</h2><p>预测仅使用统计截止位置之前的计数</p></div><div class="compact-controls"><Select v-model="direction" :options="[{ label: '进入人数', value: 'entries' }, { label: '离开人数', value: 'exits' }]" option-label="label" option-value="value" aria-label="计数方向" /><Select v-model="horizon" :options="[15,30,60].map(value => ({ label: `未来 ${value} 分钟`, value }))" option-label="label" option-value="value" aria-label="预测时长" /><Button label="短时预测" icon="pi pi-chart-line" :loading="predicting" @click="predict" /></div></div><Message v-if="forecastError" severity="error">{{ forecastError }}</Message><Message v-if="forecast && forecast.status !== 'ready'" severity="warn">{{ forecast.reason || (forecast.status === 'quality_insufficient' ? '计数质量不足，暂停预测' : '历史窗口不足，暂停预测') }}</Message><TrendChart v-if="historyPoints.length" :points="historyPoints" :forecast="forecast?.status === 'ready' ? forecast.forecast_points : []" short label="入口通行人数" /><StatePanel v-else kind="empty" message="截止位置前尚无完整计数窗口，请向后移动时间轴。" /><div class="chart-footer"><span>{{ options.mode === 'demo' ? '模拟计数 · 未执行真实检测或 OpenVINO 推理' : `检测模型 ${completeCounts.at(-1)?.detector_model_version || '—'} · OpenVINO ${completeCounts.at(-1)?.openvino_version || '—'} · ${completeCounts.at(-1)?.device || '—'}` }}</span><span v-if="forecast?.status === 'ready'">{{ forecast.model_version }} · 截止 {{ forecast.training_cutoff?.slice(11,19) }}</span></div></article>
    </template>
  </section>
</template>
