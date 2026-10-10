import { chromium } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:5173/transport', { waitUntil: 'networkidle' })

if (page.url().includes('/login')) {
  await page.getByRole('button', { name: '进入演示工作台' }).click()
  await page.waitForURL('**/transport')
}

await page.waitForSelector('.transport-screen-grid')
await page.waitForTimeout(1800)
await page.screenshot({ path: 'test-results/bigscreen-1920.png', fullPage: true })

console.log(JSON.stringify({
  url: page.url(),
  title: await page.title(),
  viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
  panels: await page.locator('.screen-panel').count(),
  canvases: await page.locator('canvas').count(),
}))

await browser.close()
