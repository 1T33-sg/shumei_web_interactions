import { createApp, defineComponent, h, Teleport } from 'vue'
import { useRoute } from 'vue-router'
import PrimeVue from 'primevue/config'
import App from '../../../web_dashboard/src/App.vue'
import { router, registerInteractionRoutes } from '../../../web_dashboard/src/app/router'
import { installRouteGuard } from '../../../web_dashboard/src/app/route_guard'
import { interactionRoutes } from '../routes'
import { interactionTheme } from '../theme'
import { interactions } from './runtime'
import SessionControls from './SessionControls.vue'
import 'primeicons/primeicons.css'
import '../../../web_dashboard/src/styles/tokens.css'
import '../../../web_dashboard/src/styles/global.css'
import '../styles.css'

registerInteractionRoutes(router, interactionRoutes)
for (const route of router.getRoutes()) {
  if (['dashboard', 'scenic', 'holidays'].includes(String(route.name))) route.meta.requiresAuth = true
}
interactions.installGuard(router)
installRouteGuard(router)

const Root = defineComponent({
  setup() {
    const route = useRoute()
    return () => [h(App), route.path !== '/login'
      ? h(Teleport, { to: '.topbar-right', defer: true }, h(SessionControls)) : null]
  },
})
const app = createApp(Root)
app.use(PrimeVue, { theme: { preset: interactionTheme, options: { darkModeSelector: '.app-dark' } } })
app.use(interactions)
app.use(router)
void router.isReady().then(() => app.mount('#app'))
