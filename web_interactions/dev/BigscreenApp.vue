<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { useInteractions } from '../src/module'
import LegacyApp from './App.vue'

const route = useRoute()
const router = useRouter()
const { auth, options } = useInteractions()
const aboutVisible = ref(false)
const screenScale = ref(1)
const clock = ref('')
let clockTimer: number | undefined

const links = [
  { to: '/transport', label: '交通客流', short: '交通', icon: 'pi pi-chart-line' },
  { to: '/events', label: '事件热力', short: '事件', icon: 'pi pi-map-marker' },
  { to: '/assistant', label: '文旅助手', short: '助手', icon: 'pi pi-sparkles' },
  { to: '/video', label: '视频分析', short: '视频', icon: 'pi pi-video' },
]

const title = computed(() => String(route.meta.title ?? '文旅数据中台'))
const isBigscreen = computed(() => route.name === 'b-transport')
const screenStyle = computed(() => ({
  transform: `scale(${screenScale.value}) translate(-50%, -50%)`,
}))

function fitScreen() {
  screenScale.value = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
}

function tick() {
  const now = new Date()
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  const pad = (value: number) => String(value).padStart(2, '0')
  clock.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 星期${weekday} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

async function logout() {
  try { await auth.logout() } finally { await router.replace('/login') }
}

watch(() => route.path, () => {
  aboutVisible.value = false
  document.title = `${title.value} · 皖行`
})

onMounted(() => {
  fitScreen()
  tick()
  document.title = `${title.value} · 皖行`
  window.addEventListener('resize', fitScreen)
  clockTimer = window.setInterval(tick, 1000)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitScreen)
  if (clockTimer) window.clearInterval(clockTimer)
})
</script>

<template>
  <LegacyApp v-if="!isBigscreen" />

  <div v-else-if="isBigscreen" class="b-ui bigscreen-stage">
    <div id="bigscreen" class="bigscreen-root" :style="screenStyle">
      <header class="bigscreen-header">
        <div class="bigscreen-header-side bigscreen-header-left">
          <span class="bigscreen-brand">WENLV · DATA</span>
          <nav class="bigscreen-nav" aria-label="主导航">
            <RouterLink v-for="link in links" :key="link.to" :to="link.to">
              <i :class="link.icon" aria-hidden="true" />
              {{ link.short }}
            </RouterLink>
          </nav>
        </div>
        <h1>安徽文旅交通客流观察与预测大屏</h1>
        <div class="bigscreen-header-side bigscreen-header-right">
          <span class="bigscreen-clock">{{ clock }}</span>
          <span class="mode-chip">{{ options.mode === 'demo' ? '演示数据' : '接口数据' }}</span>
          <button class="header-action" type="button" aria-label="退出登录" @click="logout">
            <i class="pi pi-sign-out" />
          </button>
        </div>
      </header>

      <main class="bigscreen-content" :aria-label="title">
        <RouterView />
      </main>

      <button class="bigscreen-info" type="button" @click="aboutVisible = true">
        <i class="pi pi-info-circle" /> 数据说明
      </button>
    </div>
  </div>

  <div v-else class="b-ui app-shell">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark">皖</div>
        <div>
          <p>文旅数据中台</p>
          <span>交通 · 事件 · 洞察</span>
        </div>
      </div>

      <nav class="side-nav" aria-label="主导航">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">
          <i :class="link.icon" aria-hidden="true" />
          <span>{{ link.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <span class="mode-chip">演示数据</span>
        <p>所有模拟数据均有明确标注。</p>
      </div>
    </aside>

    <section class="shell-main">
      <header class="topbar">
        <div>
          <span class="eyebrow">ANHUI CULTURAL TOURISM</span>
          <h1>{{ title }}</h1>
        </div>
        <div class="topbar-actions">
          <button class="icon-button" type="button" aria-label="数据说明" @click="aboutVisible = true">
            <i class="pi pi-info-circle" />
          </button>
          <div class="account-chip">
            <i class="pi pi-user" />
            <span>{{ auth.state.session?.user.display_name ?? '演示用户' }}</span>
          </div>
          <Button icon="pi pi-sign-out" label="退出" severity="secondary" outlined size="small" @click="logout" />
        </div>
      </header>
      <main class="content-area">
        <RouterView />
      </main>
    </section>
  </div>

  <Drawer v-if="route.name !== 'b-login'" v-model:visible="aboutVisible" header="数据与演示说明" position="right" class="about-drawer">
    <div class="drawer-copy">
      <section>
        <span class="drawer-number">01</span>
        <div><h3>演示环境</h3><p>当前使用本地模拟接口，数据仅用于交互联调与比赛演示。</p></div>
      </section>
      <section>
        <span class="drawer-number">02</span>
        <div><h3>统计口径</h3><p>铁路展示发送量，机场展示旅客吞吐量，页面不会将两类口径直接合并。</p></div>
      </section>
      <section>
        <span class="drawer-number">03</span>
        <div><h3>预测说明</h3><p>预测结果为模型估计值，应结合数据来源、缺失期与回测指标判断。</p></div>
      </section>
    </div>
  </Drawer>
</template>
