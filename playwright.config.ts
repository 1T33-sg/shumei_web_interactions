import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/e2e', timeout: 45000, workers: 1,
 use: { baseURL: 'http://127.0.0.1:5183', channel: 'chrome', screenshot: 'only-on-failure' },
 webServer: [{ command: 'node node_modules/vite/bin/vite.js --config vite.config.ts --port 5183', url: 'http://127.0.0.1:5183', reuseExistingServer: false, env: { VITE_DATA_MODE: 'demo' } }, { command: 'node node_modules/vite/bin/vite.js --config vite.config.ts --port 5184', url: 'http://127.0.0.1:5184', reuseExistingServer: false, env: { VITE_DATA_MODE: 'api' } }],
})
