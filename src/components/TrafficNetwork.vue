<script setup lang="ts">
import { computed } from 'vue'
import type { Entity } from '../types/api'
const props = defineProps<{ entities: Entity[]; activeId: string }>()
const nodes = computed(() => props.entities.slice(0, 5).map((entity, index) => ({
  entity,
  x: [170, 385, 625, 280, 535][index] ?? 400,
  y: [180, 292, 170, 430, 430][index] ?? 300,
})))
</script>

<template>
  <div class="network-visual">
    <svg viewBox="0 0 800 510" role="img" aria-label="安徽交通枢纽联动示意图，位置不代表地理比例">
      <defs>
        <linearGradient id="network-line" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00d4ff" stop-opacity=".18"/><stop offset=".5" stop-color="#00d4ff" stop-opacity=".9"/><stop offset="1" stop-color="#3a7bd5" stop-opacity=".22"/></linearGradient>
        <filter id="network-glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path class="network-boundary" d="M356 35 L493 63 565 118 676 135 724 228 669 296 684 401 598 469 470 451 386 482 289 441 184 451 105 371 126 287 74 213 141 123 246 103Z" />
      <g class="network-grid"><path d="M120 170H680M96 255H710M118 340H680M190 92V440M300 62V468M410 46V472M520 68V458M630 116V418" /></g>
      <template v-for="(node, index) in nodes" :key="node.entity.id">
        <line v-if="index" :x1="nodes[0]?.x" :y1="nodes[0]?.y" :x2="node.x" :y2="node.y" class="network-route" />
      </template>
      <g v-for="node in nodes" :key="node.entity.id" :transform="`translate(${node.x} ${node.y})`" :class="['network-node', { active: node.entity.id === activeId }]">
        <circle class="network-ripple" r="24"/><circle class="network-core" r="10" filter="url(#network-glow)"/><circle class="network-center" r="4"/>
        <text x="18" y="-12">{{ node.entity.name }}</text><text x="18" y="8" class="node-type">{{ node.entity.type === 'airport' ? '机场 · 旅客吞吐量' : '铁路站 · 发送量' }}</text>
      </g>
    </svg>
    <div class="network-caption"><span><i class="network-key active" />当前对象</span><span><i class="network-key" />可选枢纽</span><span>示意网络 · 非地理比例</span></div>
  </div>
</template>

<style scoped>
.network-visual {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 45%, rgba(0, 173, 255, .1), transparent 42%),
    linear-gradient(rgba(0, 212, 255, .025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, .025) 1px, transparent 1px);
  background-size: auto, 34px 34px, 34px 34px;
}

svg { width: 100%; height: calc(100% - 28px); display: block; }

.network-boundary {
  fill: rgba(7, 47, 93, .34);
  stroke: #00bfe8;
  stroke-width: 2;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 10px rgba(0, 196, 255, .22));
}

.network-grid path {
  fill: none;
  stroke: rgba(0, 212, 255, .075);
  stroke-width: 1;
  stroke-dasharray: 3 8;
}

.network-route {
  stroke: url(#network-line);
  stroke-width: 2.2;
  stroke-dasharray: 10 9;
  fill: none;
  animation: route-flow 2.8s linear infinite;
}

.network-node text {
  fill: #a8c9e7;
  font-size: 15px;
  font-family: "Microsoft YaHei", sans-serif;
}

.network-node .node-type { fill: #5d83aa; font-size: 11px; }
.network-core { fill: #0aa9dc; stroke: #86edff; stroke-width: 2; }
.network-center { fill: #eaffff; }
.network-ripple { fill: none; stroke: rgba(0, 212, 255, .24); stroke-width: 2; transform-origin: center; animation: node-pulse 2.5s ease-out infinite; }
.network-node.active .network-core { fill: #ffb64c; stroke: #fff1c1; }
.network-node.active .network-ripple { stroke: rgba(255, 182, 76, .55); }
.network-node.active text { fill: #f5fbff; font-weight: 650; }

.network-caption {
  position: absolute;
  right: 15px;
  bottom: 9px;
  display: flex;
  gap: 18px;
  color: #5e84aa;
  font-size: 10px;
}

.network-caption span { display: inline-flex; align-items: center; gap: 5px; }
.network-key { width: 7px; height: 7px; border-radius: 50%; background: #00bde8; box-shadow: 0 0 7px rgba(0, 212, 255, .7); }
.network-key.active { background: #ffb64c; box-shadow: 0 0 7px rgba(255, 182, 76, .7); }

@keyframes route-flow { to { stroke-dashoffset: -38; } }
@keyframes node-pulse { 0% { transform: scale(.45); opacity: .9; } 80%, 100% { transform: scale(1.25); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .network-route, .network-ripple { animation: none; }
}
</style>
