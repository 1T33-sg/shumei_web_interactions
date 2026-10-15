<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useInteractions } from '../module'
import { errorMessage } from '../api/client'
import { integrationConfigError } from './runtime'

const { auth, options } = useInteractions()
const router = useRouter()
const leaving = ref(false), error = ref('')
async function logout() {
  leaving.value = true
  error.value = ''
  try { await auth.logout(); await router.replace('/login') }
  catch (cause) { error.value = errorMessage(cause) }
  finally { leaving.value = false }
}
</script>

<template>
  <span class="host-session-controls">
    <span v-if="options.mode === 'demo'" class="host-demo">演示数据</span>
    <button type="button" :disabled="leaving" @click="logout">{{ leaving ? '正在退出…' : '退出登录' }}</button>
    <span v-if="error || integrationConfigError" class="host-session-error" role="alert">{{ error || integrationConfigError }}</span>
  </span>
</template>

<style scoped>
.host-session-controls { display: contents; }
.host-session-controls button { padding: 5px 9px; border: 1px solid var(--border-glow); background: rgba(0, 212, 255, .08); color: var(--accent); font-size: 11px; white-space: nowrap; }
.host-demo { color: var(--accent-green); font-size: 10px; white-space: nowrap; }
.host-session-error { position: absolute; right: 12px; top: 100%; z-index: 20; padding: 8px; background: #412332; color: #f4c5b8; font-size: 12px; }
</style>
