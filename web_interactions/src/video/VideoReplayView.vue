<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import StatePanel from '../components/StatePanel.vue'
import TrendChart from '../components/TrendChart.vue'
import { useInteractions } from '../module'
import { ApiError, errorMessage, query } from '../api/client'
import type { AnalysisAccepted, AnalysisJob, CameraForecast, CountGrain, Counts, VideoItem } from '../types/api'
import { dateText, numberText } from '../utils'
import { analysisRequest, readCounts, readForecast } from './contract'

const { client, options, auth } = useInteractions()
const jobIds = ref<Record<string, string>>({ ...options.analysisJobs })
const jobInput = ref(''), roiInput = ref(''), job = ref<AnalysisJob | null>(null), jobError = ref(''), submitting = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined, jobVersion = 0
const isAdmin = computed(() => auth.state.session?.user.role === 'admin')
const selectedAnalysisIds = ref<Record<string, string>>({ ...options.analysisIds })
const cameraNames = ref<Record<string, string>>({ ...options.cameraNames })
const analysisInput = ref(''), analysisInputError = ref('')
const videos = ref<VideoItem[]>([]), videoId = ref(''), counts = ref<Counts | null>(null), forecast = ref<CameraForecast | null>(null)
const loading = ref(true), error = ref(''), countLoading = ref(false), countError = ref(''), analysisNotReady = ref(false)
const forecastError = ref(''), predicting = ref(false)
const position = ref(7200), grain = ref<CountGrain>('5min'), horizon = ref<15 | 30>(30)
const player = ref<HTMLVideoElement>(), localUrl = ref(''), fileInput = ref<HTMLInputElement>(), playbackError = ref('')
const video = computed(() => videos.value.find(v => v.id === videoId.value))
const duration = computed(() => video.value ? Math.max(0, (Date.parse(video.value.recorded_end_at) - Date.parse(video.value.recorded_start_at)) / 1000) : 0)
const cutoff = computed(() => video.value ? chinaTime(Date.parse(video.value.recorded_start_at) + position.value * 1000) : '')
const completeCounts = computed(() => counts.value?.points.filter(p => Date.parse(p.period_end) <= Date.parse(cutoff.value)) ?? [])
const latestCount = computed(() => completeCounts.value.at(-1))
const qualityLabels: Record<string, string> = { good: '良好（good）', degraded: '质量下降（degraded）', unavailable: '缺测（unavailable）', demo: '历史模拟数据', verified: '已核验', valid: '有效', ok: '有效', missing: '缺失', occluded: '遮挡', low_quality: '质量不足', invalid: '无效', unverified: '待核验' }
const analysisState = computed(() => counts.value ? '可用' : job.value?.status === 'failed' ? '失败' : job.value?.status === 'queued' ? '排队中' : job.value?.status === 'running' ? '处理中' : analysisNotReady.value || job.value?.status === 'succeeded' ? '结果未就绪' : !selectedAnalysisIds.value[videoId.value] ? '未开始' : countLoading.value ? '正在读取' : '暂不可用')
const countQuality = computed(() => latestCount.value ? qualityLabels[latestCount.value.quality_status] || latestCount.value.quality_status : '暂无计数')
const roiPoints = computed(() => counts.value?.roi.map(point => point.join(',')).join(' ') ?? '')
const hasInterval = computed(() => forecast.value?.status === 'ready' && forecast.value.forecast_points.some(p => p.lower_bound != null && p.upper_bound != null))
const forecastNotice = computed(() => !forecast.value || forecast.value.status === 'ready' ? '' : forecast.value.reason || (forecast.value.status === 'quality_insufficient' ? '计数质量不足，暂停预测' : '有效历史不足或回测未通过，暂停预测'))
const playbackSrc = computed(() => options.mode === 'demo' ? localUrl.value : video.value ? `/api/v1/videos/${encodeURIComponent(video.value.id)}/playback` : '')
let generation = 0, forecastVersion = 0

function chinaTime(time: number) { return new Date(time + 8 * 3600000).toISOString().slice(0, 19) + '+08:00' }
function videoError(e: unknown) {
  if (!(e instanceof ApiError)) return errorMessage(e)
  if (e.status === 409 && e.code === 'analysis_not_ready') return '分析结果未就绪（409 analysis_not_ready），不代表零人数。'
  if (e.status === 401) return '登录已失效，请重新登录。'
  if (e.status === 403) return '无权读取或操作这段录像，请联系管理员确认授权。'
  if (e.status === 503 || e.status === 0) return '依赖服务不可用，暂时无法读取或处理录像。'
  return `录像请求失败（${e.status} ${e.code}），请联系管理员核对结果与授权。`
}
function positionLabel(seconds: number) { return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(Math.floor(seconds) % 60).padStart(2, '0')}` }
function clearForecast() { ++forecastVersion; forecast.value = null; forecastError.value = ''; predicting.value = false }
function releaseLocalPreview() { if (localUrl.value) URL.revokeObjectURL(localUrl.value); localUrl.value = ''; if (fileInput.value) fileInput.value.value = '' }
async function loadVideos() {
  stopPolling()
  loading.value = true; error.value = ''
  try {
    if (options.mode === 'demo') {
      const demo = await import('../../dev/fixtures')
      selectedAnalysisIds.value = { ...demo.demoAnalysisIds, ...selectedAnalysisIds.value }
      cameraNames.value = { ...cameraNames.value, ...demo.demoCameraNames }
    }
    const result = (await client.get<VideoItem[]>('/videos?page_size=100')).data
    if (!Array.isArray(result) || result.some(v => !v || typeof v.id !== 'string' || typeof v.camera_id !== 'string' || !Number.isFinite(Date.parse(v.recorded_start_at)) || !Number.isFinite(Date.parse(v.recorded_end_at)) || Date.parse(v.recorded_start_at) > Date.parse(v.recorded_end_at))) throw new Error('录像元数据的身份或录制起止时间无效')
    videos.value = result
    videoId.value = videos.value[0]?.id ?? ''
    await selectVideo()
  } catch (e) { error.value = videoError(e) }
  finally { loading.value = false }
}
async function selectVideo() {
  stopPolling(); job.value = null; jobError.value = ''; roiInput.value = ''
  player.value?.pause(); releaseLocalPreview(); playbackError.value = ''
  position.value = Math.min(7200, duration.value)
  analysisInput.value = selectedAnalysisIds.value[videoId.value] ?? ''; analysisInputError.value = ''
  jobInput.value = jobIds.value[analysisInput.value] ?? ''
  await loadCounts()
  if (jobInput.value && isAdmin.value) await refreshJob()
}
async function loadCounts() {
  const current = ++generation; clearForecast(); counts.value = null; countError.value = ''; analysisNotReady.value = false; countLoading.value = true
  const analysisId = selectedAnalysisIds.value[videoId.value]
  if (!analysisId) { countLoading.value = false; return }
  const requestedGrain = grain.value
  try {
    const response = await client.get<unknown>(`/videos/${encodeURIComponent(videoId.value)}/counts?${query({ analysis_id: analysisId, grain: requestedGrain })}`)
    const result = readCounts(response.data, requestedGrain, analysisId, options.mode === 'demo')
    if (current === generation) counts.value = result
  } catch (e) {
    if (current === generation) { countError.value = videoError(e); analysisNotReady.value = e instanceof ApiError && e.status === 409 && e.code === 'analysis_not_ready' }
  } finally { if (current === generation) countLoading.value = false }
}
async function associateAnalysis() {
  const id = analysisInput.value.trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { analysisInputError.value = '请输入有效的分析结果编号（UUID）'; return }
  stopPolling(); job.value = null; jobError.value = ''; selectedAnalysisIds.value[videoId.value] = id; analysisInputError.value = ''
  jobInput.value = jobIds.value[id] ?? ''
  await loadCounts()
  if (jobInput.value && isAdmin.value) await refreshJob()
}
function stopPolling() { ++jobVersion; if (pollTimer) clearTimeout(pollTimer); pollTimer = undefined }
async function refreshJob() {
  stopPolling()
  const id = jobInput.value.trim(), analysisId = selectedAnalysisIds.value[videoId.value], current = jobVersion
  if (!isAdmin.value || !id) return
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) { jobError.value = '请输入有效的作业编号（UUID）'; return }
  jobError.value = ''
  try {
    const { data } = await client.get<AnalysisJob>(`/jobs/${encodeURIComponent(id)}`)
    if (current !== jobVersion) return
    if (data.id !== id || data.type !== 'video_analysis' || data.analysis_id !== analysisId || !['queued', 'running', 'succeeded', 'failed'].includes(data.status)) throw new Error('作业与当前录像分析不匹配')
    job.value = data; jobIds.value[analysisId!] = id
    if (data.status === 'failed') { ++generation; clearForecast(); counts.value = null; countLoading.value = false; analysisNotReady.value = false; countError.value = '' }
    else if (data.status === 'succeeded') await loadCounts()
    else pollTimer = setTimeout(() => { void refreshJob() }, 3000)
  } catch (e) { if (current === jobVersion) jobError.value = e instanceof ApiError && e.status === 403 ? '无权查询作业；作业接口仅对管理员开放。' : '作业状态暂不可读取，请稍后重试。' }
}
async function submitAnalysis() {
  if (!video.value || !isAdmin.value || submitting.value) return
  submitting.value = true; analysisInputError.value = ''
  const selectedVideo = videoId.value
  try {
    const body = analysisRequest(JSON.parse(roiInput.value))
    const { data } = await client.post<AnalysisAccepted>(`/videos/${encodeURIComponent(selectedVideo)}/analyses`, body)
    if (videoId.value !== selectedVideo) return
    if (data.video_id !== selectedVideo || data.status !== 'queued' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.analysis_id) || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.job_id)) throw new Error('分析任务响应与当前录像不一致')
    selectedAnalysisIds.value[selectedVideo] = data.analysis_id; analysisInput.value = data.analysis_id
    jobIds.value[data.analysis_id] = data.job_id; jobInput.value = data.job_id
    await loadCounts(); await refreshJob()
  } catch (e) { analysisInputError.value = e instanceof SyntaxError ? 'ROI 请填写 [x,y] 顶点数组，例如 [[0,0],[1,0],[1,1]]；应使用人工确认的实际区域。' : videoError(e) }
  finally { submitting.value = false }
}
function seek() { if (options.mode === 'api' && player.value && Number.isFinite(player.value.duration)) player.value.currentTime = Math.min(position.value, player.value.duration) }
function updateTime() { if (options.mode === 'api' && player.value) position.value = Math.min(player.value.currentTime, duration.value) }
async function predict() {
  const analysisId = selectedAnalysisIds.value[videoId.value]
  if (!analysisId || !counts.value || countLoading.value) return
  player.value?.pause()
  const current = ++forecastVersion; forecast.value = null; forecastError.value = ''; predicting.value = true
  const requestedCutoff = cutoff.value, requestedHorizon = horizon.value
  try {
    const response = await client.post<CameraForecast>(`/videos/${encodeURIComponent(videoId.value)}/short-forecast`, { analysis_id: analysisId, cutoff_at: requestedCutoff, horizon_minutes: requestedHorizon, step_minutes: 5 })
    const result = readForecast(response.data, requestedCutoff, requestedHorizon)
    if (current === forecastVersion) forecast.value = result.status === 'ready' ? result : { ...result, forecast_points: [] }
  } catch (e) { if (current === forecastVersion) forecastError.value = videoError(e) }
  finally { if (current === forecastVersion) predicting.value = false }
}
function localPreview(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('video/')) { playbackError.value = '请选择浏览器可播放的视频文件'; return }
  if (localUrl.value) URL.revokeObjectURL(localUrl.value)
  localUrl.value = URL.createObjectURL(file); playbackError.value = ''
}
watch([horizon, position], clearForecast, { flush: 'sync' })
watch(grain, loadCounts)
onMounted(loadVideos)
onBeforeUnmount(() => { stopPolling(); ++generation; ++forecastVersion; releaseLocalPreview() })
</script>
<template>
  <section class="b-ui page-stack video-page">
    <header class="page-heading"><div><div class="eyebrow">RECORDED VIDEO ANALYSIS</div><h1>录像回放</h1><p>查看固定 ROI 估计可见人数、计数质量与未来画面人数预测。</p></div><Tag value="录像回放 · 非实时" severity="warn" /></header>
    <Message v-if="options.mode === 'demo'" severity="warn">synthetic · 合成计数与状态演示，未执行真实录像推理或人工评估。</Message>
    <div class="panel filters">
      <label class="field grow">录像片段<Select :pt="{ overlay: { class: 'b-ui b-select-overlay' } }" v-model="videoId" :options="videos.map(v => ({ value: v.id, label: `${cameraNames[v.camera_id] || v.camera_id} · ${dateText(v.recorded_start_at)}` }))" option-label="label" option-value="value" aria-label="录像片段" @change="selectVideo" /></label>
      <label class="field">计数粒度<Select :pt="{ overlay: { class: 'b-ui b-select-overlay' } }" v-model="grain" :options="[{ label: '5 分钟中位数', value: '5min' }, { label: '逐帧估计', value: 'frame' }]" option-label="label" option-value="value" aria-label="计数粒度" /></label>
      <div class="recording-meta"><span>录制时间</span><strong>{{ dateText(video?.recorded_start_at, true) }} — {{ dateText(video?.recorded_end_at, true) }}</strong></div>
    </div>
    <form v-if="options.mode === 'api' && video" class="panel filters" @submit.prevent="associateAnalysis">
      <label class="field grow">分析结果编号<input v-model="analysisInput" aria-label="分析结果编号" placeholder="填写该录像已完成的分析结果编号" /></label>
      <Button type="submit" label="关联分析结果" :disabled="countLoading" />
      <p v-if="analysisInputError" role="alert">{{ analysisInputError }}</p>
      <p class="muted small">由管理员提供对应录像的分析结果编号；服务器负责校验访问权限和录像归属。</p>
    </form>
    <details v-if="isAdmin && video" class="panel analysis-admin"><summary>管理员 · 分析任务与作业状态</summary>
      <p class="muted small">正式配置固定为 P2PNet / leader-SHTechA-50604773 / pytorch / CPU，阈值由服务端固定为 0.5；10 秒抽帧，5 分钟中位数。</p>
      <form class="filters" @submit.prevent="submitAnalysis"><label class="field grow">已确认的 ROI 顶点<input v-model="roiInput" aria-label="已确认的 ROI 顶点" placeholder="填写人工确认的归一化 [x,y] 顶点数组" /></label><Button type="submit" label="提交 P2PNet 分析" :loading="submitting" :disabled="!roiInput.trim()" /></form>
      <p v-if="options.mode === 'demo'" class="notice">此处仅提交到 synthetic 演示处理器。</p>
      <form class="filters" @submit.prevent="refreshJob"><label class="field grow">作业编号<input v-model="jobInput" aria-label="作业编号" placeholder="填写该分析返回的 job_id" /></label><Button type="submit" label="读取作业状态" :disabled="!jobInput.trim()" /></form>
      <p v-if="analysisInputError" role="alert">{{ analysisInputError }}</p><p v-if="jobError" role="alert">{{ jobError }}</p>
    </details>
    <StatePanel v-if="loading || error" :kind="loading ? 'loading' : 'error'" :message="error" @retry="loadVideos" />
    <StatePanel v-else-if="!video" kind="empty" message="暂无获准回放的录像。待上传并授权后可查看。" />
    <template v-else>
      <div class="panel analysis-status" role="status"><Tag :value="analysisState" :severity="job?.status === 'failed' ? 'danger' : counts ? 'success' : 'warn'" /><span v-if="job?.status === 'failed'">分析失败，请联系管理员查看受保护的作业记录。未生成可用人数。</span><span v-else-if="job?.status === 'queued' || job?.status === 'running'">正在等待分析完成，人数保持缺测。</span><span v-else-if="!counts && !selectedAnalysisIds[videoId]">尚未提交或关联分析。</span></div>
      <div class="video-grid">
        <article class="panel replay-panel">
          <div class="panel-heading"><h2>{{ cameraNames[video.camera_id] || video.camera_id }}</h2><span class="small muted"><i class="pi pi-video" /> 录像回放</span></div>
          <video v-if="playbackSrc" ref="player" :key="playbackSrc" :src="playbackSrc" controls preload="metadata" class="video-player" @loadedmetadata="seek" @timeupdate="updateTime" @error="playbackError = '录像暂时无法播放，请检查文件格式、会话或访问授权'" />
          <div v-else class="video-placeholder"><div class="gate-blueprint" aria-hidden="true"><span /><span /><span /><i class="pi pi-video" /></div><h3>授权录像待接入</h3><p>当前展示画面人数与时间轴的交互演示</p></div>
          <div v-if="options.mode === 'demo'" class="local-preview-controls"><Button label="选择本地录像预览" icon="pi pi-folder-open" severity="secondary" outlined @click="fileInput?.click()" /><input ref="fileInput" type="file" accept="video/*" class="sr-only" aria-label="选择本地录像" @change="localPreview" /><span class="small muted">文件仅在本机播放，不上传；演示计数、ROI 与该文件无关联，演示时间轴独立。</span></div>
          <Message v-if="playbackError" severity="error">{{ playbackError }}</Message>
          <div class="replay-timeline"><label for="replay-position"><span>回放位置</span><strong>{{ positionLabel(position) }} <span class="muted">/ {{ positionLabel(duration) }}</span></strong></label><input id="replay-position" v-model.number="position" type="range" min="0" :max="duration" step="1" @input="seek" /><div><span>{{ video.recorded_start_at.slice(11,16) }}</span><span>{{ cutoff.slice(11,19) }} · 统计截止位置</span><span>{{ video.recorded_end_at.slice(11,16) }}</span></div></div>
        </article>
        <aside class="panel counter-panel">
          <span class="eyebrow">VISIBLE PEOPLE</span><h2>固定 ROI 估计可见人数</h2>
          <p class="muted small">{{ grain === '5min' ? '截止位置前最近完整窗口的有效帧中位数' : '截止位置前最近抽样帧的估计人数' }}</p>
          <div class="count-item"><span><i class="pi pi-users" />{{ grain === '5min' ? '最近窗口人数' : '最近帧人数' }}</span><strong>{{ latestCount?.value == null ? '缺测' : numberText(latestCount.value) }}<small v-if="latestCount?.value != null">人</small></strong></div>
          <div class="model-details">
            <div><span>计数时间</span><strong>{{ latestCount?.period_end.slice(11,19) || '—' }}</strong></div>
            <div><span>计数质量</span><strong>{{ countQuality }}</strong></div>
            <div v-if="grain === '5min'"><span>有效抽样帧</span><strong>{{ latestCount?.sample_count ?? '—' }} 帧</strong></div>
            <div><span>人工评估{{ options.mode === 'demo' ? '（synthetic）' : '' }}</span><strong>{{ counts?.manual_validation ? `${counts.manual_validation.sample_count} 帧 · MAE ${numberText(counts.manual_validation.mae)} 人` : '未人工评估' }}</strong></div>
          </div>
          <p class="notice">每点表示画面人数估计，不能相加为通行人次，也不代表全景区在园人数。</p>
        </aside>
      </div>
      <StatePanel v-if="countLoading" kind="loading" message="正在读取所选粒度的画面人数。" />
      <div v-else-if="analysisNotReady" class="panel"><Message severity="warn">{{ countError }}</Message><Button label="重新加载" severity="secondary" @click="loadCounts" /></div>
      <StatePanel v-else-if="countError" kind="error" :message="countError" @retry="loadCounts" />
      <Message v-else-if="!counts" severity="warn">暂未关联可读取的分析结果，计数与短时预测将在分析完成后提供。</Message>
      <template v-else>
        <article class="panel count-metadata">
          <div class="roi-summary"><svg viewBox="0 0 1 1" preserveAspectRatio="none" role="img" aria-label="固定统计区域 ROI 归一化坐标示意"><polygon :points="roiPoints" /></svg><div><h2>固定统计区域 ROI</h2><p class="muted small">归一化区域示意（非录像截图）</p><code>{{ counts.roi.map(point => `(${point.join(', ')})`).join(' · ') }}</code></div></div>
          <dl class="analysis-details">
            <div><dt>计数模型</dt><dd>{{ counts.count_model === 'dm_count' ? '历史 DM-Count（非当前正式模型）' : 'P2PNet' }}</dd></div>
            <div><dt>权重版本</dt><dd>{{ counts.weights_version }}</dd></div>
            <div><dt>推理引擎 / 设备</dt><dd>{{ counts.inference_engine }} / {{ counts.device }}</dd></div>
            <div v-if="counts.inference_engine === 'openvino'"><dt>OpenVINO 版本</dt><dd>{{ counts.openvino_version || '未提供' }}</dd></div>
            <div><dt>抽帧间隔</dt><dd>{{ counts.sample_interval_seconds != null ? `${counts.sample_interval_seconds} 秒` : '接口未提供' }}</dd></div>
            <div><dt>聚合口径</dt><dd>5 分钟有效帧中位数</dd></div>
            <div v-if="counts.count_model === 'p2pnet'"><dt>固定阈值</dt><dd>{{ counts.confidence_threshold }}</dd></div>
            <div v-if="counts.weights_sha256"><dt>权重摘要</dt><dd>{{ counts.weights_sha256 }}</dd></div>
            <div v-if="counts.model_source_revision"><dt>源码修订</dt><dd>{{ counts.model_source_revision }}</dd></div>
            <div v-if="grain === '5min'"><dt>aggregation_rule</dt><dd>{{ latestCount?.aggregation_rule || '暂无有效窗口' }}</dd></div>
          </dl>
          <p v-if="options.mode === 'demo'" class="muted small">synthetic · 模型名称描述接口格式，合成数值不代表模型效果。</p>
        </article>
        <article class="panel video-trend-panel">
          <div class="panel-heading"><div><h2>画面人数趋势与短时预测</h2><p>预测使用截止位置之前的有效 5 分钟计数，与当前查看粒度无关。</p></div><div class="compact-controls">
            <Select :pt="{ overlay: { class: 'b-ui b-select-overlay' } }" v-model="horizon" :options="[15,30].map(value => ({ label: `未来 ${value} 分钟`, value }))" option-label="label" option-value="value" aria-label="预测时长" />
            <Button label="短时预测" icon="pi pi-chart-line" :loading="predicting" @click="predict" />
          </div></div>
          <div class="chart-legend"><span><i class="legend-line" />历史计数（模型估计）</span><span><i class="legend-line forecast" />未来画面人数预测</span><span v-if="hasInterval"><i class="legend-band" />预测区间</span></div>
          <Message v-if="forecastError" severity="error">{{ forecastError }}</Message>
          <Message v-if="forecastNotice" severity="warn">{{ forecastNotice }}</Message>
          <TrendChart v-if="completeCounts.length && !forecastNotice" :points="completeCounts" :forecast="forecast?.status === 'ready' ? forecast.forecast_points : []" short label="画面可见人数" history-label="计数估计" unit="人" />
          <StatePanel v-else-if="forecastNotice" kind="empty" message="预测结果为空；当前数据或质量不足，不以历史计数代替预测。" />
          <StatePanel v-else kind="empty" message="截止位置前尚无完整计数点，请向后移动时间轴。缺失人数不会补零。" />
          <div class="chart-footer"><span>单位：人 · {{ grain === '5min' ? '5 分钟中位数' : '逐帧估计' }} · {{ completeCounts.length }} 个计数点</span><span v-if="forecast">{{ forecast.model_version }} · 输入历史 {{ numberText(forecast.input_window_minutes) }} 分钟 · 截止 {{ forecast.training_cutoff?.slice(11,19) }}</span></div>
          <p class="forecast-validation small muted">分跨度回测误差{{ options.mode === 'demo' ? '（synthetic）' : '' }}：<template v-if="forecast?.validation_error"><span v-for="(validation, minutes) in forecast.validation_error" :key="minutes">{{ minutes }} 分钟 MAE {{ numberText(validation?.mae) }} 人 · {{ validation?.sample_count }} 个样本；</span></template><span v-else>未提供</span></p>
          <p class="small muted forecast-guidance">仅开放 15 / 30 分钟，每 5 分钟一点；60 分钟暂不开放。预测需要足够有效历史与回测依据。</p>
        </article>
      </template>
    </template>
  </section>
</template>
