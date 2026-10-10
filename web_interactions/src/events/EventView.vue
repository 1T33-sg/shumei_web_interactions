<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Drawer from 'primevue/drawer'
import StatePanel from '../components/StatePanel.vue'
import { useInteractions } from '../module'
import { useEntityNavigation } from '../entity-navigation'
const { openEntity, navigationError, navigating } = useEntityNavigation()
import { errorMessage, query, safeSourceUrl } from '../api/client'
import type { EventItem } from '../types/api'
import { dateText, effectiveEventStatus, severityLabels } from '../utils'
const { client, options } = useInteractions(), route = useRoute()
const events = ref<EventItem[]>([]), loading = ref(true), error = ref(''), page = ref(1), total = ref(0)
const status = ref(''), severity = ref(''), region = ref(''), authority = ref('')
const selected = ref<EventItem | null>(null), drawerOpen = ref(false), detailLoading = ref(false), detailError = ref('')
let listVersion = 0, detailVersion = 0
const shown = computed(() => events.value.filter(e => (!severity.value || e.severity === severity.value) && (status.value !== 'active' || effectiveEventStatus(e) === 'active')))
const statusLabels = { active: '生效中', resolved: '已解除', expired: '有效期已结束', scheduled: '尚未生效' }
const regions = computed(() => [{ label: '全部地区', value: '' }, ...(options.regions ?? [])])
async function load(reset = false) {
  if (reset) page.value = 1
  const current = ++listVersion; loading.value = true; error.value = ''; events.value = []
  try {
    const response = await client.get<EventItem[]>(`/events?${query({ status: status.value, authority: authority.value, region_code: region.value, page: page.value, page_size: 20 })}`)
    if (current === listVersion) { events.value = response.data; total.value = response.meta.total ?? response.data.length }
  } catch (e) { if (current === listVersion) error.value = errorMessage(e) }
  finally { if (current === listVersion) loading.value = false }
}
async function detail(id: string) {
  const current = ++detailVersion; drawerOpen.value = true; detailLoading.value = true; detailError.value = ''; selected.value = null
  try { const response = await client.get<EventItem>(`/events/${encodeURIComponent(id)}`); if (current === detailVersion) selected.value = response.data }
  catch (e) { if (current === detailVersion) detailError.value = errorMessage(e) }
  finally { if (current === detailVersion) detailLoading.value = false }
}
function openQueryDetail() { if (typeof route.query.id === 'string') void detail(route.query.id) }
onMounted(() => { void load(); openQueryDetail() })
watch(() => route.query.id, openQueryDetail)
</script>
<template>
  <section class="b-ui page-stack">
    <p v-if="navigationError" role="alert">{{ navigationError }}</p>
    <header class="page-heading"><div><div class="eyebrow">EVENTS & NOTICES</div><h1>事件中心<span class="heading-dot">.</span></h1><p>关注旅途中的变化，让信息有来源、有时效。</p></div><Button icon="pi pi-refresh" label="刷新事件" outlined severity="secondary" :loading="loading" @click="load()" /></header>
    <div class="panel filters">
      <label class="field grow">事件状态<Select v-model="status" :options="[{ label: '全部状态', value: '' }, { label: '当前有效', value: 'active' }, { label: '已解除', value: 'resolved' }]" option-label="label" option-value="value" aria-label="事件状态" @change="load(true)" /></label>
      <label class="field grow">信息类型<Select v-model="authority" :options="[{ label: '全部类型', value: '' }, { label: '官方公告', value: 'official' }, { label: '模型提示', value: 'model_signal' }]" option-label="label" option-value="value" aria-label="信息类型" @change="load(true)" /></label>
      <label class="field grow">影响地区<Select v-model="region" :options="regions" option-label="label" option-value="value" aria-label="影响地区" @change="load(true)" /></label>
      <label class="field grow">级别（本页）<Select v-model="severity" :options="[{ label: '全部级别', value: '' }, ...Object.entries(severityLabels).map(([value, label]) => ({ value, label }))]" option-label="label" option-value="value" aria-label="事件级别" /></label>
    </div>
    <div class="section-label"><span>事件动态 <b>{{ shown.length }}</b></span><span class="muted small">级别筛选作用于当前页 · 过期公告不计为当前有效</span></div>
    <StatePanel v-if="loading || error" :kind="loading ? 'loading' : 'error'" :message="error" @retry="load()" />
    <StatePanel v-else-if="!shown.length" kind="empty" message="当前筛选条件下没有事件，可以调整筛选条件。" />
    <div v-else class="event-list">
      <button v-for="event in shown" :key="event.id" class="panel event-row" @click="detail(event.id)">
        <span :class="['event-icon', event.authority === 'model_signal' ? 'signal' : '']"><i :class="['pi', event.authority === 'model_signal' ? 'pi-wave-pulse' : 'pi-megaphone']" /></span>
        <div class="event-content"><div class="event-tags"><Tag :value="`${options.mode === 'demo' ? '模拟 · ' : ''}${event.authority === 'official' ? '官方公告' : '模型提示'}`" :severity="event.authority === 'official' ? 'success' : 'warn'" /><span class="muted small">{{ severityLabels[event.severity] || event.severity }}</span></div><h2>{{ event.title }}</h2><p>{{ dateText(event.published_at, true) }} 发布 <span>·</span> 影响 {{ event.affected_entity_ids.length }} 个对象</p></div>
        <div class="event-state"><span :class="['status-dot', effectiveEventStatus(event) === 'active' ? 'active' : '']" />{{ statusLabels[effectiveEventStatus(event)] }}<i class="pi pi-angle-right" /></div>
      </button>
    </div>
    <div class="pagination"><span>第 {{ page }} 页 · 接口返回共 {{ total }} 条</span><Button label="上一页" icon="pi pi-angle-left" severity="secondary" text :disabled="page <= 1 || loading" @click="page--; load()" /><Button label="下一页" icon="pi pi-angle-right" icon-pos="right" severity="secondary" text :disabled="page * 20 >= total || loading" @click="page++; load()" /></div>
    <div class="panel definition-bar"><i class="pi pi-shield" /><div><strong>来源不同，意义也不同</strong><p>官方公告以发布机构与原始链接为准。模型提示仅供趋势分析，不代表官方预警。</p></div></div>
    <Drawer v-model:visible="drawerOpen" header="事件详情" position="right" class="b-ui b-drawer"><p v-if="navigationError" role="alert">{{ navigationError }}</p>
      <StatePanel v-if="detailLoading || detailError" :kind="detailLoading ? 'loading' : 'error'" :message="detailError" @retry="drawerOpen = false" />
      <template v-else-if="selected"><Tag :value="selected.authority === 'official' ? '官方公告' : '模型提示 · 非官方预警'" :severity="selected.authority === 'official' ? 'success' : 'warn'" /><h2>{{ selected.title }}</h2><p class="detail-body">{{ selected.description }}</p><dl class="detail-list"><dt>状态</dt><dd>{{ statusLabels[effectiveEventStatus(selected)] }}</dd><dt>开始时间</dt><dd>{{ dateText(selected.starts_at, true) }}</dd><dt>结束时间</dt><dd>{{ dateText(selected.ends_at, true) }}</dd><dt>最近核验</dt><dd>{{ dateText(selected.last_verified_at, true) }}</dd><dt>影响对象</dt><dd v-for="id in selected.affected_entity_ids" :key="id"><button class="text-link" :disabled="navigating" @click="openEntity(id).then(opened => { if (opened) drawerOpen = false })">查看关联对象</button></dd></dl><h3>事件时间线</h3><ol class="timeline"><li v-for="(item, i) in selected.timeline" :key="i"><span>{{ dateText(item.at, true) }}</span><strong>{{ item.label }}</strong><p>{{ item.description }}</p></li></ol><a v-if="safeSourceUrl(selected.source_url)" :href="safeSourceUrl(selected.source_url)" target="_blank" rel="noopener noreferrer" class="text-link">查看公告原文 <i class="pi pi-arrow-up-right" /></a><p v-else class="muted small">{{ options.mode === 'demo' ? '演示事件没有真实公告链接。' : '来源链接尚未提供。' }}</p></template>
    </Drawer>
  </section>
</template>
