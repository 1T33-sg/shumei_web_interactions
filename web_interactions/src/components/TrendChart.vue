<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { graphic, init, use, type EChartsType } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkAreaComponent, AriaComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Point } from '../types/api'
use([LineChart, GridComponent, TooltipComponent, MarkAreaComponent, AriaComponent, CanvasRenderer])
const props = defineProps<{ points: Point[]; forecast?: Point[]; label?: string; short?: boolean }>()
const host = ref<HTMLDivElement>()
let chart: EChartsType | undefined
let observer: ResizeObserver | undefined
const all = computed(() => [...props.points, ...(props.forecast ?? [])])
const divisor = computed(() => all.value.some(p => (p.value ?? 0) >= 10000) ? 10000 : 1)
function draw() {
  if (!chart) return
  const historyLength = props.points.length
  const value = (p: Point, field: 'value' | 'lower_bound' | 'upper_bound') => p[field] == null ? null : p[field]! / divisor.value
  const labels = all.value.map(p => props.short ? p.period_end.slice(11, 16) : p.period_start.slice(0, 7))
  chart.setOption({
    animation: typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationDuration: 900, animationEasing: 'cubicOut',
    aria: { enabled: true }, backgroundColor: 'transparent',
    grid: { top: 38, left: 54, right: 24, bottom: 34, containLabel: false },
    tooltip: { trigger: 'axis', renderMode: 'richText', backgroundColor: 'rgba(9, 29, 52, .96)', borderColor: 'rgba(53, 201, 255, .4)', textStyle: { color: '#e9f5ff' }, formatter: (params: unknown) => {
      const items = params as { dataIndex: number }[]
      const index = items[0]?.dataIndex ?? 0, p = all.value[index]
      if (!p) return ''
      return `${labels[index]}${index >= historyLength ? ' · 预测' : ''}\n${p.value == null ? '缺失' : (p.value / divisor.value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${divisor.value === 10000 ? '万' : ''}${p.unit}${p.lower_bound != null && p.upper_bound != null ? `\n区间 ${(p.lower_bound / divisor.value).toFixed(1)} – ${(p.upper_bound / divisor.value).toFixed(1)}` : ''}`
    } },
    xAxis: { type: 'category', boundaryGap: false, data: labels, axisLine: { lineStyle: { color: 'rgba(111, 144, 177, .34)' } }, axisTick: { show: false }, axisLabel: { color: '#87a6c5', hideOverlap: true, margin: 14 } },
    yAxis: { type: 'value', name: (divisor.value === 10000 ? '万' : '') + (all.value[0]?.unit ?? '人次'), nameTextStyle: { color: '#87a6c5' }, axisLabel: { color: '#87a6c5' }, splitLine: { lineStyle: { color: 'rgba(111, 144, 177, .14)', type: 'dashed' } } },
    series: [
      { name: props.label || '历史值', type: 'line', data: all.value.map((p, i) => i < historyLength ? value(p, 'value') : null), smooth: .25, connectNulls: false, symbol: 'circle', symbolSize: 6, showSymbol: false, lineStyle: { color: '#35c9ff', width: 2.5, shadowColor: 'rgba(53, 201, 255, .35)', shadowBlur: 10 }, itemStyle: { color: '#35c9ff' }, areaStyle: { color: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(53, 201, 255, .30)' }, { offset: 1, color: 'rgba(53, 201, 255, .02)' }]) } },
      { name: '区间下界', type: 'line', data: all.value.map((p, i) => i >= historyLength ? value(p, 'lower_bound') : null), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, silent: true },
      { name: '预测区间', type: 'line', data: all.value.map((p, i) => i >= historyLength && p.lower_bound != null && p.upper_bound != null ? (p.upper_bound - p.lower_bound) / divisor.value : null), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: '#8fa8ff', opacity: .16 }, silent: true },
      { name: '预测值', type: 'line', data: all.value.map((p, i) => i >= historyLength ? value(p, 'value') : null), smooth: .25, symbolSize: 5, lineStyle: { color: '#8fa8ff', width: 2, type: 'dashed' }, itemStyle: { color: '#8fa8ff' } },
    ],
  }, true)
}
onMounted(() => { if (host.value) { chart = init(host.value); observer = new ResizeObserver(() => chart?.resize()); observer.observe(host.value); draw() } })
watch(() => [props.points, props.forecast, props.short], draw, { deep: true })
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose() })
</script>
<template>
  <div ref="host" class="trend-chart" role="img" :aria-label="`${label || '客流'}趋势图，包含 ${points.length} 个历史数据点和 ${forecast?.length || 0} 个预测数据点；详细数值见下方数据表`" />
  <details class="chart-data"><summary>查看图表数据</summary><div class="table-scroll"><table><thead><tr><th>统计时间</th><th>类型</th><th>数值</th><th>单位</th><th>区间</th></tr></thead><tbody><tr v-for="(p, i) in all" :key="`${p.period_start}-${i}`"><td>{{ p.period_start }}</td><td>{{ i < points.length ? '历史' : '预测' }}</td><td>{{ p.value ?? '缺失' }}</td><td>{{ p.unit }}</td><td>{{ p.lower_bound != null ? `${p.lower_bound} – ${p.upper_bound}` : '—' }}</td></tr></tbody></table></div></details>
</template>
