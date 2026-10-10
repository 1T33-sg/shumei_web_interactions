import { createRouter, createWebHistory } from 'vue-router'
import { interactionRoutes } from '@anhui/web-interactions'
import DashboardView from '../features/dashboard/DashboardView.vue'
import ScenicView from '../features/scenic/ScenicView.vue'
import HolidayView from '../features/holidays/HolidayView.vue'
export const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/', name: 'dashboard', component: DashboardView, meta: { title: '全域总览', requiresAuth: true } },
  { path: '/scenic', name: 'scenic', component: ScenicView, meta: { title: '景区客流', requiresAuth: true } },
  { path: '/holidays', name: 'holidays', component: HolidayView, meta: { title: '假期专题', requiresAuth: true } },
  ...interactionRoutes, { path: '/:pathMatch(.*)*', redirect: '/' },
], scrollBehavior: () => ({ top: 0 }) })
