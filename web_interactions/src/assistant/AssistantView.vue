<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import Drawer from 'primevue/drawer'
import { useInteractions } from '../module'
import { useEntityNavigation } from '../entity-navigation'
import { safeSourceUrl } from '../api/client'
import { assistantError, evidenceState, readAnswer } from './evidence'
import type { Answer, Citation, KnowledgeDocument } from '../types/api'
import { dateText } from '../utils'
import StatePanel from '../components/StatePanel.vue'
const { openEntity, navigationError, navigating } = useEntityNavigation()
const { client, options } = useInteractions(), route = useRoute()
const input = ref(''), pending = ref(false), conversationId = ref<string>(), bottom = ref<HTMLElement>()
const messages = ref<{ question: string; response?: Answer; error?: string }[]>([])
const documents = reactive<Record<string, { data?: KnowledgeDocument; error?: string; loading: boolean }>>({})
const selectedCitation = ref<Citation | null>(null)
const selectedDocument = computed(() => selectedCitation.value ? documents[selectedCitation.value.id] : undefined)
const suggestions = ['合肥南站的月度客流有什么变化？', '铁路发送量和机场吞吐量有什么区别？', '现在景区有多少人？']
const statusLabels = { answered: '附来源回答', insufficient_evidence: '证据不足', metric_tool_unavailable: '指标查询依赖不可用' }
async function loadDocument(id: string, retry = false) {
  if (!retry && documents[id]) return
  documents[id] = { loading: true }
  try {
    const { data } = await client.get<KnowledgeDocument>('/knowledge/documents/' + encodeURIComponent(id))
    if (data.id && data.id !== id) throw new Error('资料身份与引用不一致，已停止展示')
    if (!Array.isArray(data.allowed_snippets ?? data.snippets ?? [])) throw new Error('资料片段格式不符合约定')
    documents[id] = { data, loading: false }
  } catch (error) { documents[id] = { error: assistantError(error), loading: false } }
}
function openDocument(citation: Citation) { selectedCitation.value = citation; void loadDocument(citation.id) }
async function send(retryIndex?: number) {
  const question = typeof retryIndex === 'number' ? messages.value[retryIndex]?.question ?? '' : input.value.trim()
  if (!question || question.length > 1000 || pending.value) return
  const index = typeof retryIndex === 'number' ? retryIndex : messages.value.push({ question }) - 1
  messages.value[index]!.error = undefined; messages.value[index]!.response = undefined; input.value = ''; pending.value = true
  await nextTick(); bottom.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  try {
    const response = await client.post<unknown>('/assistant/chat', { message: question, ...(conversationId.value ? { conversation_id: conversationId.value } : {}), ...(typeof route.query.entity_id === 'string' ? { context: { entity_ids: [route.query.entity_id] } } : {}) })
    const answer = readAnswer(response.data)
    messages.value[index]!.response = answer; conversationId.value = answer.conversation_id
    // Only returned document identities are queried; filenames never become IDs.
    void Promise.all([...new Set(answer.citations.filter(c => c.type === 'document').map(c => c.id))].slice(0, 20).map(id => loadDocument(id)))
  } catch (error) { messages.value[index]!.error = assistantError(error) }
  finally { pending.value = false; await nextTick(); bottom.value?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }
}
onMounted(() => { if (typeof route.query.question === 'string') input.value = route.query.question.slice(0, 1000) })
</script>
<template>
  <section class="b-ui page-stack assistant-page">
    <p v-if="navigationError" role="alert">{{ navigationError }}</p>
    <header class="page-heading"><div><div class="eyebrow">DATA ASSISTANT</div><h1>智能问答</h1><p>回答附来源、资料日期与适用期；历史资料需要核验时效。</p></div><Button label="新对话" icon="pi pi-plus" outlined severity="secondary" :disabled="pending || !messages.length" @click="messages = []; conversationId = undefined; input = ''" /></header>
    <p v-if="options.mode === 'demo'" class="notice">synthetic · 回答、引用和数值为合成演示，未调用真实问答服务。</p>
    <div class="panel chat-panel">
      <div v-if="!messages.length" class="chat-welcome"><div class="assistant-symbol"><i class="pi pi-sparkles" /></div><span class="eyebrow">数据查询 · 资料检索</span><h2>文旅交通数据助手</h2><p>查询交通趋势、理解统计口径，或追溯事件来源。</p><div class="suggestions"><button v-for="question in suggestions" :key="question" @click="input = question">{{ question }}</button></div></div>
      <div v-else class="chat-messages" aria-live="polite">
        <article v-for="(message, index) in messages" :key="index" class="exchange">
          <div class="user-message"><span class="avatar small-avatar">你</span><p>{{ message.question }}</p></div>
          <div class="answer-message"><span class="avatar assistant-avatar"><i class="pi pi-sparkles" /></span><div class="answer-body">
            <div class="answer-label">皖行助手 <span>{{ options.mode === 'demo' ? 'synthetic · 预设回答' : '数据与资料检索' }}</span></div>
            <template v-if="message.response">
              <Tag :value="statusLabels[message.response.status]" :severity="message.response.status === 'answered' ? 'info' : 'warn'" />
              <p class="answer-text">{{ message.response.answer }}</p>
              <p v-if="message.response.status === 'answered' && !message.response.citations.length" class="notice">接口未返回引用，当前回答尚无法追溯核验。</p>
              <div v-if="message.response.metric_result" class="query-context"><p>数据时间 {{ message.response.metric_result.period_start || '未提供' }} — {{ message.response.metric_result.period_end || '未提供' }} · 查询时间 {{ dateText(message.response.metric_result.queried_at, true) }}</p><p>指标 {{ message.response.metric_result.metric }} · 返回值 {{ message.response.metric_result.value }} · 来源 {{ message.response.metric_result.source_ids.join('、') }}</p></div>
              <div v-if="message.response.used_metric_queries.length" class="query-context"><div v-for="(item, i) in message.response.used_metric_queries" :key="i"><template v-if="typeof item === 'string'">指标查询记录：{{ item }}</template><template v-else>数据时间 {{ item.period_start }} — {{ item.period_end }}<button class="text-link" :disabled="navigating" @click="openEntity(item.entity_id)">查看图表 <i class="pi pi-arrow-up-right" /></button></template></div></div>
              <div v-if="message.response.citations.length" class="citations"><span class="small muted">参考来源</span>
                <div v-for="(citation, i) in message.response.citations" :key="i" class="citation evidence-citation"><span class="citation-index">{{ i + 1 }}</span><div class="evidence-body">
                  <strong>{{ citation.title }}</strong><span>资料日期：{{ dateText(citation.date) }}</span><span>引用身份：{{ citation.id }}</span><span v-if="citation.chunk_id">片段定位：{{ citation.chunk_id }}</span>
                  <template v-if="citation.type === 'document'"><template v-if="documents[citation.id]?.data"><span>适用期：{{ dateText(documents[citation.id]!.data!.valid_from) }} — {{ dateText(documents[citation.id]!.data!.valid_until) }}</span><p class="notice">{{ evidenceState(documents[citation.id]!.data!) }}</p></template><span v-else>{{ documents[citation.id]?.error || '适用期尚未核验，请先查看资料。' }}</span><button class="text-link" @click="openDocument(citation)">查看资料</button></template>
                  <RouterLink v-else-if="citation.type === 'event'" :to="{ name: 'b-events', query: { id: citation.id } }">查看事件与适用期</RouterLink>
                  <a v-if="safeSourceUrl(citation.url || documents[citation.id]?.data?.source_url)" :href="safeSourceUrl(citation.url || documents[citation.id]?.data?.source_url)" target="_blank" rel="noopener noreferrer">查看来源原文</a><span v-else-if="citation.type !== 'document'">接口未提供可用来源链接</span>
                </div></div>
              </div>
              <ul v-if="message.response.limitations.length" class="limitations"><li v-for="item in message.response.limitations" :key="item">{{ item }}</li></ul>
            </template>
            <div v-else-if="message.error" role="alert"><p>{{ message.error }}</p><Button label="重试此问题" text icon="pi pi-refresh" :disabled="pending" @click="send(index)" /></div><p v-else class="thinking"><i class="pi pi-spin pi-spinner" />正在整理回答与引用…</p>
          </div></div>
        </article><div ref="bottom" />
      </div>
      <form class="chat-composer" @submit.prevent="send()"><label class="sr-only" for="question">输入问题</label><Textarea id="question" v-model="input" placeholder="例如：合肥南站最近几个月的发送量有什么变化？" rows="2" :maxlength="1000" :disabled="pending" @keydown.ctrl.enter.prevent="send()" /><div class="composer-footer"><span>依据可用资料回答 <span class="char-count">{{ input.length }}/1000</span></span><Button type="submit" label="发送" icon="pi pi-arrow-up" :loading="pending" :disabled="!input.trim() || pending" /></div></form>
    </div><p class="chat-footnote">回答受数据覆盖范围与资料时效限制，请结合引用核验。</p>
    <Drawer :visible="!!selectedCitation" header="引用资料" position="right" class="b-ui b-drawer" @update:visible="value => { if (!value) selectedCitation = null }">
      <StatePanel v-if="selectedDocument?.loading || selectedDocument?.error" :kind="selectedDocument.loading ? 'loading' : 'error'" :message="selectedDocument.error" @retry="selectedCitation && loadDocument(selectedCitation.id, true)" />
      <template v-else-if="selectedDocument?.data"><h2>{{ selectedDocument.data.title }}</h2><p class="muted">{{ selectedDocument.data.publisher }} · 资料日期 {{ dateText(selectedDocument.data.published_at) }}</p><p>文档身份：{{ selectedCitation?.id }}</p><p>片段定位：{{ selectedCitation?.chunk_id || '接口未提供片段身份' }}</p><p>适用期：{{ dateText(selectedDocument.data.valid_from) }} — {{ dateText(selectedDocument.data.valid_until) }}</p><p class="notice">{{ evidenceState(selectedDocument.data) }}</p><p class="muted small">以下为接口获准展示的片段；当前接口未提供片段与页码、段落的对应关系。</p><p v-for="(snippet, i) in selectedDocument.data.allowed_snippets ?? selectedDocument.data.snippets ?? []" :key="i" class="detail-body">{{ snippet }}</p><p>{{ selectedDocument.data.permission_note }}</p><a v-if="safeSourceUrl(selectedDocument.data.source_url)" :href="safeSourceUrl(selectedDocument.data.source_url)" target="_blank" rel="noopener noreferrer">查看来源原文</a><p v-else>接口未提供可用来源链接</p></template>
    </Drawer>
  </section>
</template>
