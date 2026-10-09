<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import { safeRedirect, useInteractions } from '../module'
import { errorMessage } from '../api/client'
const { auth, options } = useInteractions(), route = useRoute(), router = useRouter()
const username = ref(''), password = ref(''), loading = ref(false), error = ref('')
async function login(demo = false) {
  if (loading.value) return
  if (!demo && (username.value.trim().length < 3 || password.value.length < 8)) { error.value = '用户名至少 3 个字符，密码至少 8 个字符'; return }
  loading.value = true; error.value = ''
  try { await auth.login(demo ? 'demo' : username.value.trim(), demo ? 'demo2026' : password.value); await router.replace(safeRedirect(route.query.redirect)) }
  catch (e) { error.value = errorMessage(e) }
  finally { password.value = ''; loading.value = false }
}
</script>
<template>
  <section class="b-ui login-page">
    <div class="login-story"><a class="brand" href="#"><span class="brand-mark"><i class="pi pi-compass" /></span><span>皖行<span class="brand-en">ANHUI OBSERVATORY</span></span></a><div class="login-story-content"><span class="eyebrow">每一程，都有迹可循</span><h1>看见流动的安徽。<br /><span>读懂旅途的变化。</span></h1><p>让交通数据、旅途事件与入口观察相互连接，<br />为每一次探索，提供清晰的视角。</p><div class="journey-art" aria-hidden="true"><div class="journey-route" /><span class="journey-node hefei"><i class="pi pi-directions" /><b>合肥</b></span><span class="journey-node huangshan"><i class="pi pi-map-marker" /><b>黄山</b></span><span class="journey-node airport"><i class="pi pi-send" /><b>新桥机场</b></span></div></div><div class="login-story-footer">安徽文旅交通客流观察与预测 <span>·</span> 以数据理解旅程</div></div>
    <div class="login-form-wrap"><form class="login-form" @submit.prevent="login()"><span class="eyebrow">WELCOME BACK</span><h2>欢迎回来</h2><p class="muted">登录皖行，继续你的数据探索。</p><Message v-if="route.query.expired" severity="warn">会话已结束，请重新登录。</Message><Message v-if="error" severity="error">{{ error }}</Message><label class="field" for="username">用户名<InputText id="username" v-model="username" autocomplete="username" minlength="3" maxlength="64" placeholder="请输入用户名" required /></label><label class="field" for="password">密码<Password input-id="password" v-model="password" :feedback="false" toggle-mask autocomplete="current-password" placeholder="请输入密码" :input-props="{ required: true, minlength: 8 }" /></label><Button type="submit" label="登录工作台" icon="pi pi-arrow-right" icon-pos="right" :loading="loading" class="login-submit" /><template v-if="options.mode === 'demo'"><div class="login-divider"><span>先体验已完成的界面</span></div><Button type="button" label="进入演示工作台" icon="pi pi-play" severity="secondary" outlined :loading="loading" @click="login(true)" /><p class="small muted login-note">无需真实账号。演示数据与预设回答仅用于功能预览。</p></template><p v-else class="small muted login-note">账号由管理员分配。如需访问权限，请联系项目管理员。</p></form><span class="login-copyright">皖行 · 数据有源，判断有据</span></div>
  </section>
</template>
