<script setup lang="ts">
import { graphic, init, use, type EChartsType } from 'echarts/core'
import { BarChart, GaugeChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, AriaComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

use([BarChart, GaugeChart, PieChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer])

interface Datum { name: string; value: number }
const props = defineProps<{ type: 'bar' | 'donut' | 'gauges'; data: Datum[]; unit?: string }>()
const host = ref<HTMLDivElement>()
let chart: EChartsType | undefined
let highlightTimer: number | undefined
const colors = ['#00d4ff', '#3a7bd5', '#00f2a9', '#ffb84d', '#8f7bff', '#ff7f9e']
const tooltip = { backgroundColor: 'rgba(10,26,60,.96)', borderColor: 'rgba(0,212,255,.45)', textStyle: { color: '#e6f7ff', fontSize: 12 } }

function option() {
  if (props.type === 'bar') return {
    animationDuration: 1000, aria: { enabled: true }, tooltip: { ...tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 8, left: 12, right: 62, bottom: 6, containLabel: true },
    xAxis: { type: 'value', axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', inverse: true, data: props.data.map(d => d.name), axisLabel: { color: '#c0d8f0', fontSize: 12 }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar', barWidth: 10, data: props.data.map(d => d.value), label: { show: true, position: 'right', color: '#00d4ff', fontWeight: 600, formatter: ({ value }: { value: number }) => `${Number(value).toFixed(1)}${props.unit || ''}` }, itemStyle: { borderRadius: 5, color: new graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: '#00d4ff' }, { offset: 1, color: 'rgba(0,212,255,.06)' }]) } }],
  }
  if (props.type === 'donut') return {
    animationDuration: 1000, color: colors, aria: { enabled: true }, tooltip: { ...tooltip, trigger: 'item', formatter: `{b}: {c}${props.unit || ''} ({d}%)` },
    legend: { orient: 'vertical', right: 8, top: 'middle', itemWidth: 12, itemHeight: 8, textStyle: { color: '#c0d8f0', fontSize: 12 } },
    series: [{ type: 'pie', radius: ['48%', '72%'], center: ['36%', '52%'], label: { show: false }, itemStyle: { borderColor: '#0a1a3c', borderWidth: 2 }, data: props.data }],
  }
  return {
    animationDuration: 1000, aria: { enabled: true },
    series: props.data.map((item, index) => ({
      type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: 100, radius: '74%', center: [`${18 + index * 32}%`, '54%'],
      progress: { show: true, width: 9, itemStyle: { color: colors[index] } }, axisLine: { lineStyle: { width: 9, color: [[1, 'rgba(107,147,184,.16)']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
      detail: { fontSize: 22, color: colors[index], fontWeight: 700, formatter: '{value}%', offsetCenter: [0, 2] },
      title: { show: true, offsetCenter: [0, '76%'], color: '#6b93b8', fontSize: 12 }, data: [{ value: item.value, name: item.name }],
    })),
  }
}
function draw() { chart?.setOption(option(), true) }
onMounted(() => {
  if (!host.value) return
  chart = init(host.value); draw()
  if (props.type === 'donut' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let current = 0
    highlightTimer = window.setInterval(() => {
      if (document.hidden || !props.data.length) return
      chart?.dispatchAction({ type: 'downplay', seriesIndex: 0 })
      chart?.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: current })
      current = (current + 1) % props.data.length
    }, 2400)
  }
})
watch(() => [props.type, props.data, props.unit], draw, { deep: true })
onBeforeUnmount(() => { if (highlightTimer) clearInterval(highlightTimer); chart?.dispose() })
</script>

<template><div ref="host" class="bigscreen-chart-canvas" role="img" :aria-label="`${type} 图表，共 ${data.length} 项`" /></template>
