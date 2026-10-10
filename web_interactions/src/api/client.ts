import { normalizeForecast } from './forecast'
import type { Envelope } from '../types/api'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId?: string) { super(message) }
}
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>
export function createApiClient(options: { fetcher?: Fetcher; csrf: () => string | null; unauthorized: () => void }) {
  const fetcher = options.fetcher ?? ((input, init) => fetch(input, init))
  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<Envelope<T>> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API 路径必须以单个 / 开头')
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (method !== 'GET' && path !== '/auth/login') {
      const token = options.csrf()
      if (!token) throw new ApiError(401, 'missing_session', '登录已失效，请重新登录')
      headers['X-CSRF-Token'] = token
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetcher(`/api/v1${path}`, { method, headers, credentials: 'same-origin', signal: controller.signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      if (response.status === 401 && path !== '/auth/login') options.unauthorized()
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new ApiError(response.status, payload?.error?.code ?? 'request_failed', payload?.error?.message ?? '请求失败，请稍后重试', payload?.request_id)
      if (!payload || !('data' in payload) || !payload.meta) throw new ApiError(502, 'invalid_response', '接口返回格式不符合约定')
      if (path === '/forecasts/history' || path.endsWith('/short-forecast')) payload.data = normalizeForecast(payload.data)
      return payload as Envelope<T>
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(0, 'network_error', controller.signal.aborted ? '请求超时，请重试' : '暂时无法连接服务，请检查后端是否启动')
    } finally { clearTimeout(timer) }
  }
  return { request, get: <T>(path: string) => request<T>(path), post: <T>(path: string, body?: unknown) => request<T>(path, 'POST', body) }
}
export type ApiClient = ReturnType<typeof createApiClient>
export function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value))
  return params.toString()
}
export function safeSourceUrl(value?: string): string | undefined {
  if (!value) return undefined
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined }
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : '发生未知错误，请重试' }
