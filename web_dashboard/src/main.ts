import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import { interactionTheme } from '@anhui/web-interactions'
import App from './App.vue'
import { router } from './app/router'
import { interactions } from './app/runtime'
import 'primeicons/primeicons.css'
import './styles/tokens.css'
import './styles/global.css'
import '@anhui/web-interactions/styles.css'
interactions.installGuard(router)
createApp(App).use(PrimeVue, { theme: { preset: interactionTheme, options: { darkModeSelector: '.app-dark' } } }).use(interactions).use(router).mount('#app')
