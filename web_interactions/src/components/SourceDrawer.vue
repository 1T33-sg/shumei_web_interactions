<script setup lang="ts">
import { ref, watch } from 'vue'
import Drawer from 'primevue/drawer'
import StatePanel from './StatePanel.vue'
import { useInteractions } from '../module'
import { errorMessage, safeSourceUrl } from '../api/client'
import type { Source } from '../types/api'
import { dateText } from '../utils'
const props = defineProps<{ sourceId: string | null }>()
const emit = defineEmits<{ close: [] }>()
const { client } = useInteractions()
const source = ref<Source | null>(null), error = ref(''), loading = ref(false)
let version = 0
async function load() {
  const current = ++version; source.value = null; error.value = ''
  if (!props.sourceId) return
  loading.value = true
  try { const response = await client.get<Source>(`/sources/${encodeURIComponent(props.sourceId)}`); if (current === version) source.value = response.data }
  catch (e) { if (current === version) error.value = errorMessage(e) }
  finally { if (current === version) loading.value = false }
}
watch(() => props.sourceId, load, { immediate: true })
</script>
<template>
  <Drawer :visible="!!sourceId" position="right" header="数据来源" class="b-ui b-drawer" @update:visible="value => { if (!value) emit('close') }">
    <StatePanel v-if="loading || error" :kind="loading ? 'loading' : 'error'" :message="error" @retry="load" />
    <template v-else-if="source"><span class="eyebrow">SOURCE DETAILS</span><h2>{{ source.title }}</h2><p class="muted">{{ source.publisher }}</p><dl class="detail-list"><dt>发布时间</dt><dd>{{ dateText(source.published_at, true) }}</dd><dt>采集时间</dt><dd>{{ dateText(source.retrieved_at, true) }}</dd><dt>数据覆盖</dt><dd>{{ source.coverage_start }} — {{ source.coverage_end }}</dd><dt>核验状态</dt><dd>{{ source.verification_status }}</dd></dl><p class="notice">{{ source.usage_note }}</p><a v-if="safeSourceUrl(source.url)" class="text-link" :href="safeSourceUrl(source.url)" target="_blank" rel="noopener noreferrer">查看原始来源 <i class="pi pi-arrow-up-right" /></a></template>
  </Drawer>
</template>
