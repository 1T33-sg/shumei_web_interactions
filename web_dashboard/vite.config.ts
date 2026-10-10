import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
export default defineConfig(({ mode }) => ({
 plugins: [vue()], resolve: { dedupe: ['vue', 'vue-router', 'primevue', '@primeuix/themes', 'echarts'], alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
 server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api/v1': { target: loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: false } } },
}))
