<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Message from 'primevue/message'
import { useInteractions } from '../src/module'
import { errorMessage } from '../src/api/client'
const { auth, options } = useInteractions(), route = useRoute(), router = useRouter()
const menuOpen = ref(false), infoOpen = ref(false), logoutError = ref(''), leaving = ref(false)
const links = [
  { path: '/transport', label: '交通客流', icon: 'pi-directions', caption: '探索出行脉络' },
  { path: '/events', label: '事件中心', icon: 'pi-megaphone', caption: '关注沿途变化' },
  { path: '/assistant', label: '智能问答', icon: 'pi-sparkles', caption: '让问题找到答案' },
  { path: '/video', label: '录像回放', icon: 'pi-video', caption: '回看画面人数' },
]
const title = computed(() => String(route.meta.title || '交通客流'))
watch(() => route.path, () => { menuOpen.value = false; document.title = `${title.value} · 皖行` })
async function logout() {
  leaving.value = true; logoutError.value = ''
  try { await auth.logout(); await router.replace('/login') } catch (e) { logoutError.value = errorMessage(e) } finally { leaving.value = false }
}
</script>
<template>
  <RouterView v-if="route.name === 'b-login'" />
  <div v-else class="b-ui demo-shell">
    <a href="#main-content" class="skip-link">跳转到主要内容</a>
    <button v-if="menuOpen" class="sidebar-backdrop" aria-label="关闭导航" @click="menuOpen = false" />
    <aside :class="['sidebar', { open: menuOpen }]"><RouterLink to="/transport" class="brand"><span class="brand-mark"><i class="pi pi-compass" /></span><span>皖行<span class="brand-en">ANHUI OBSERVATORY</span></span></RouterLink><div class="sidebar-section-label">探索与洞察</div><nav aria-label="主导航"><RouterLink v-for="link in links" :key="link.path" :to="link.path" :class="['nav-item', { active: route.path === link.path }]"><i :class="['pi', link.icon]" /><span>{{ link.label }}<small>{{ link.caption }}</small></span><i v-if="route.path === link.path" class="pi pi-angle-right nav-arrow" /></RouterLink></nav><div class="sidebar-bottom"><div class="sidebar-note"><span class="leaf-icon"><i class="pi pi-map-marker" /></span><strong>立足安徽，看见流动</strong><p>连接交通、文旅与数据<br />发现每一段旅程的价值</p></div><button class="sidebar-help" @click="infoOpen = true"><i class="pi pi-info-circle" />关于数据与口径<i class="pi pi-arrow-up-right" /></button><div class="sidebar-version">皖行观察工作台 <span>v0.1</span></div></div></aside>
    <div class="workspace"><header class="topbar"><div class="topbar-left"><Button class="menu-toggle" icon="pi pi-bars" text severity="secondary" aria-label="展开导航" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen" /><span class="breadcrumb-home">工作台</span><i class="pi pi-angle-right breadcrumb-arrow" /><strong>{{ title }}</strong></div><div class="topbar-right"><span class="environment-badge"><span />{{ options.mode === 'demo' ? '演示模式' : '接口模式' }}</span><span class="topbar-divider" /><div class="user-chip"><span class="avatar">{{ auth.state.session?.user.display_name.slice(0,1) || '访' }}</span><span>{{ auth.state.session?.user.display_name }}<small>{{ auth.state.session?.user.role === 'admin' ? '管理员' : '只读访客' }}</small></span></div><Button icon="pi pi-sign-out" text severity="secondary" aria-label="退出登录" title="退出登录" :loading="leaving" @click="logout" /></div></header>
      <main id="main-content" class="main-content"><div v-if="options.mode === 'demo'" class="demo-banner"><i class="pi pi-info-circle" /><span>演示数据，安心探索<span class="banner-detail"> · 数值、事件与回答均为模拟示例</span></span><button @click="infoOpen = true">了解详情 <i class="pi pi-arrow-up-right" /></button></div><Message v-if="logoutError" severity="error">{{ logoutError }}</Message><RouterView /></main><footer class="workspace-footer"><span>皖行 · 安徽文旅交通观察</span><span>数据有源，判断有据</span></footer>
    </div>
    <Drawer v-model:visible="infoOpen" position="right" header="数据与口径说明" class="b-ui b-drawer"><span class="eyebrow">A CLEARER PICTURE</span><h2>理解数据，才能理解旅程。</h2><div class="about-item"><i class="pi pi-database" /><div><h3>演示与真实数据</h3><p>{{ options.mode === 'demo' ? '本预览使用人工构造的数据、模拟事件和预设问答，用于检查页面交互。' : '当前通过同源业务接口读取数据，请以每条记录的来源和更新时间为准。' }}</p></div></div><div class="about-item"><i class="pi pi-directions" /><div><h3>交通指标分别观察</h3><p>铁路发送量与机场旅客吞吐量口径不同，不直接相加。月度来源保留月度粒度。</p></div></div><div class="about-item"><i class="pi pi-video" /><div><h3>录像与画面人数</h3><p>录像回放展示固定画面区域估计可见人数，帧人数不能相加为通行人次，也不代表全景区在园人数。</p></div></div><div class="about-item"><i class="pi pi-sparkles" /><div><h3>预测与问答有边界</h3><p>预测展示区间和回测误差。资料缺失或证据不足时，页面会明确提示。</p></div></div></Drawer>
  </div>
</template>
