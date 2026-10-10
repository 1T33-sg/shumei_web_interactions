<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Entity, TrendGrain, ComparisonResult } from '../../app/types'
import { compareSeries } from '../../app/data'
import { displayError } from '../../app/format'
import UiSelect from '../../components/ui/UiSelect.vue'
import TrendChart from '../../components/charts/TrendChart.vue'
const props = defineProps<{ entities: Entity[]; entityId: string; grain: TrendGrain; start: string; end: string }>()
const otherId = ref(''), result = ref<ComparisonResult | null>(null), loading = ref(false), error = ref('')
const options = computed(() => props.entities.filter(e => e.id !== props.entityId && e.available_grains.includes(props.grain)).map(e => ({value:e.id,label:e.name})))
let generation = 0
watch([() => props.entityId, () => props.grain, () => props.start, () => props.end, () => options.value.map(option => option.value).join(","), otherId], () => {
 ++generation; result.value = null; error.value = ''; loading.value = false
 if (!options.value.some(e => e.value === otherId.value)) otherId.value = options.value[0]?.value ?? ''
}, {immediate:true})
async function compare() {
 const current = ++generation; loading.value = true; error.value = ''; result.value = null
 try {
  const response = await compareSeries({series:[props.entityId,otherId.value].map(entity_id=>({entity_id,metric:'scenic_visits'})),grain:props.grain,start:props.start,end:props.end,display_mode:'separate_axes'})
  if (current === generation) result.value = response
 } catch (cause) { if (current === generation) error.value = displayError(cause) }
 finally { if (current === generation) loading.value = false }
}
</script>
<template>
 <section class="panel section-panel comparison-panel">
  <div class="panel-head"><h2 class="panel-title">跨景区对比</h2><div class="toolbar"><UiSelect v-model="otherId" :options="options" label="对比景区" /><button class="button-primary" :disabled="!entityId || !otherId || loading" @click="compare">{{loading ? '对比中…' : '生成对比'}}</button></div></div>
  <p class="chart-caption">沿用上方时间范围与粒度，两景区分别绘图，不合计人次。</p>
  <p v-if="error" role="alert">{{error}}</p>
  <p v-else-if="!options.length" class="state-box">暂无支持该粒度的其他景区。</p>
  <template v-if="result"><p class="comparison-note">{{result.comparison_note}}</p><div class="comparison-grid"><article v-for="item in result.series" :key="item.entity_id"><h3>{{entities.find(e=>e.id===item.entity_id)?.name ?? item.entity_id}}</h3><TrendChart v-if="item.points.length" :points="item.points" unit="人次" /><p v-else class="state-box">所选区间暂无数据</p><p class="chart-caption">缺失区间 {{item.missing_periods.length}} 个 · 来源 {{item.source_ids.join('、') || '未提供（演示数据不代表官方统计）'}}</p></article></div></template>
 </section>
</template>
<style scoped>.comparison-panel{margin-top:14px;flex:none}.comparison-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.comparison-grid article{min-width:0}@media(max-width:640px){.comparison-grid{grid-template-columns:1fr}}</style>
