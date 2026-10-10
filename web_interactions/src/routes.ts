import type { RouteRecordRaw } from 'vue-router'
export const interactionRoutes: RouteRecordRaw[] = [
  { path: '/login', name: 'b-login', component: () => import('./auth/LoginView.vue'), meta: { title: '登录' } },
  { path: '/transport', name: 'b-transport', component: () => import('./transport/TransportView.vue'), meta: { title: '交通客流', requiresAuth: true } },
  { path: '/events', name: 'b-events', component: () => import('./events/EventView.vue'), meta: { title: '事件中心', requiresAuth: true } },
  { path: '/assistant', name: 'b-assistant', component: () => import('./assistant/AssistantView.vue'), meta: { title: '智能问答', requiresAuth: true } },
  { path: '/video', name: 'b-video', component: () => import('./video/VideoReplayView.vue'), meta: { title: '录像回放', requiresAuth: true } },
]
