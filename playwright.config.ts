import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/e2e', timeout: 45000, workers: 1,
 use: { baseURL: 'http://127.0.0.1:5173', channel: 'chrome', screenshot: 'only-on-failure' },
 webServer: [{ command: 'pnpm dev', url: 'http://127.0.0.1:5173', reuseExistingServer: false, env: { VITE_DATA_MODE: 'demo' } }, { command: 'pnpm --filter web-dashboard dev --port 5174', url: 'http://127.0.0.1:5174', reuseExistingServer: false, env: { VITE_DATA_MODE: 'api' } }],
})
