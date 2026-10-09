import { inject, reactive, readonly, type App, type InjectionKey } from 'vue'
import type { Router } from 'vue-router'
import { ApiError, createApiClient, type Fetcher } from './api/client'
import type { Session } from './types/api'

export interface InteractionOptions {
  mode?: 'api' | 'demo'; fetcher?: Fetcher
  analysisIds?: Record<string, string>
  cameraNames?: Record<string, string>
  regions?: { label: string; value: string }[]
}
export function createInteractions(options: InteractionOptions = {}) {
  const state = reactive<{ session: Session | null; checked: boolean }>({ session: null, checked: false })
  const listeners = new Set<() => void>()
  let checking: Promise<boolean> | undefined
  const clear = () => { state.session = null; state.checked = true; listeners.forEach(fn => fn()) }
  const client = createApiClient({ fetcher: options.fetcher, csrf: () => state.session?.csrf_token ?? null, unauthorized: clear })
  async function checkSession() {
    if (state.checked) return !!state.session
    if (checking) return checking
    checking = (async () => {
      try { state.session = (await client.get<Session>('/auth/me')).data; state.checked = true; return true }
      catch (error) { if (error instanceof ApiError && error.status === 401) return false; throw error }
      finally { checking = undefined }
    })()
    return checking
  }
  const auth = {
    state: readonly(state), checkSession,
    async login(username: string, password: string) { state.session = (await client.post<Session>('/auth/login', { username, password })).data; state.checked = true },
    async logout() { await client.post('/auth/logout'); clear() },
  }
  return {
    client, auth, options: { ...options, mode: options.mode ?? 'api' },
    install(app: App) { app.provide(interactionsKey, this) },
    installGuard(router: Router) {
      listeners.add(() => {
        if (router.currentRoute.value.meta.requiresAuth) void router.replace({ name: 'b-login', query: { redirect: router.currentRoute.value.fullPath, expired: '1' } })
      })
      return router.beforeEach(async to => {
        if (!to.meta.requiresAuth) return true
        try { if (await checkSession()) return true } catch { /* The login page reports connection failures. */ }
        return { name: 'b-login', query: { redirect: to.fullPath } }
      })
    },
  }
}
export type Interactions = ReturnType<typeof createInteractions>
const interactionsKey: InjectionKey<Interactions> = Symbol('anhui-interactions')
export function useInteractions() {
  const module = inject(interactionsKey)
  if (!module) throw new Error('请先 app.use(createInteractions(...))')
  return module
}
export function safeRedirect(value: unknown) {
  return typeof value === 'string' && /^\/(transport|events|assistant|video)(?:[/?#]|$)/.test(value) ? value : '/transport'
}
