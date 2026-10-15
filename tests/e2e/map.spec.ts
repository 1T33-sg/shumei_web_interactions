import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createDemoApi } from '../../web_interactions/dev/mock'
import { dashboardDemo } from '../../web_dashboard/src/app/demo-api'

async function enterMap(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '进入演示工作台' }).click()
  const map = page.locator('.three-map-stage')
  await expect(map).toHaveAttribute('aria-busy', 'false')
  await expect(map.locator('canvas')).toBeVisible()
  await expect(map.locator('.three-map-marker').first()).toBeVisible()
  return map
}

test('full local boundaries, view controls and label switches', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const map = await enterMap(page)
  await expect(map.locator('.three-map-detail')).toHaveText('16 个地级市 · 104 个区县')
  await expect(map.locator('.three-admin-label.city')).toHaveCount(16)
  await expect(map.locator('.three-admin-label.county')).toHaveCount(104)
  await expect(map.locator('.three-map-marker')).toHaveCount(4)
  await expect(map.locator('.three-map-marker.selected')).toHaveCount(3)
  await expect(page.getByText('动态连线仅示意地点关联，非实际出行轨迹')).toBeVisible()

  await map.getByLabel('地级市', { exact: true }).uncheck()
  await expect.poll(() => map.locator('.three-admin-label.city:visible').count()).toBe(0)
  await map.getByLabel('区县', { exact: true }).uncheck()
  await expect.poll(() => map.locator('.three-admin-label.county:visible').count()).toBe(0)
  await map.getByLabel('地级市', { exact: true }).check()
  await map.getByLabel('区县', { exact: true }).check()
  await map.getByLabel('全部地名', { exact: true }).check()
  await expect.poll(() => map.locator('.three-admin-label.county:visible').count()).toBeGreaterThan(0)

  const marker = map.getByRole('button', { name: /黄山风景区，景区/ })
  const initial = await marker.evaluate(node => ({ left: node.style.left, top: node.style.top }))
  await map.getByRole('button', { name: '放大地图', exact: true }).click()
  await expect.poll(() => marker.evaluate(node => node.style.left)).not.toBe(initial.left)
  await map.getByRole('button', { name: '返回全省并恢复默认倾斜视角' }).click()
  await expect.poll(() => marker.evaluate(node => node.style.left)).toBe(initial.left)
  await map.getByRole('button', { name: '切换俯视与立体视角' }).click()
  await expect(map.getByRole('button', { name: '切换俯视与立体视角' })).toHaveText('立体')
  await expect.poll(() => marker.evaluate(node => node.style.top)).not.toBe(initial.top)
  await map.getByRole('button', { name: '返回全省并恢复默认倾斜视角' }).click()
  await expect(map.getByRole('button', { name: '切换俯视与立体视角' })).toHaveText('俯视')
  await map.getByLabel('全部地名', { exact: true }).uncheck()
  expect(errors).toEqual([])
  await page.screenshot({ path: 'test-results/map-1920.png', fullPage: true })
})

test('rotation, wheel zoom and right-button panning change the map view', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const map = await enterMap(page)
  const canvas = map.locator('canvas')
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Map canvas is missing')
  const marker = map.getByRole('button', { name: /合肥南站，铁路站/ })
  const position = () => marker.evaluate(node => `${node.style.left}/${node.style.top}`)
  const start = { x: bounds.x + bounds.width * 0.6, y: bounds.y + bounds.height * 0.7 }
  const initial = await position()
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 60, start.y - 15, { steps: 10 })
  await page.mouse.up()
  await expect.poll(position).not.toBe(initial)
  await map.getByRole('button', { name: '返回全省并恢复默认倾斜视角' }).click()
  await expect.poll(position).toBe(initial)
  await page.mouse.move(start.x, start.y)
  await page.mouse.wheel(0, -180)
  await expect.poll(position).not.toBe(initial)
  await map.getByRole('button', { name: '返回全省并恢复默认倾斜视角' }).click()
  await expect.poll(position).toBe(initial)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(start.x + 30, start.y + 10, { steps: 8 })
  await page.mouse.up({ button: 'right' })
  await expect.poll(position).not.toBe(initial)
  await map.getByRole('button', { name: '返回全省并恢复默认倾斜视角' }).click()
  await expect.poll(position).toBe(initial)
})

test('marker tooltip and keyboard selection open the scenic detail page', async ({ page }) => {
  const map = await enterMap(page)
  const marker = map.getByRole('button', { name: /黄山风景区，景区/ })
  await marker.focus()
  await expect(map.getByRole('tooltip')).toContainText('黄山风景区')
  await expect(map.getByRole('tooltip')).toContainText('接待人次：322,000 人次')
  await expect(map.getByRole('tooltip')).toContainText('静态样例')
  await marker.press('Enter')
  await expect(page).toHaveURL(/scenic\?id=00000000-0000-4000-8000-000000000001/)
})

test('boundary download failure can retry without reloading the page', async ({ page }) => {
  let available = false
  await page.route('**/geo/anhui-boundaries.json', async route => {
    if (available) await route.continue()
    else await route.fulfill({ status: 503, body: 'Temporarily unavailable' })
  })
  await page.goto('/')
  await page.getByRole('button', { name: '进入演示工作台' }).click()
  const map = page.locator('.three-map-stage')
  await expect(map.getByRole('alert')).toContainText('行政边界读取失败（HTTP 503）')
  available = true
  await page.getByRole('button', { name: '重新加载地图' }).click()
  await expect(page.locator('.three-map-canvas canvas')).toBeVisible()
  await expect(page.locator('.three-map-marker')).toHaveCount(4)
  await expect(map.getByRole('alert')).toHaveCount(0)
})

test('API mode keeps supplied point values and omits demo labels', async ({ page }) => {
  const fetcher = createDemoApi('normal', dashboardDemo('normal'))
  await page.route('**/api/v1/**', async route => {
    const request = route.request()
    const response = await fetcher(request.url(), {
      method: request.method(), headers: request.headers(), body: request.postData() ?? undefined,
    })
    await route.fulfill({ status: response.status, json: await response.json() })
  })
  await page.goto('http://127.0.0.1:5184/')
  await page.getByLabel('用户名', { exact: true }).fill('demo')
  await page.locator('#password').fill('demo2026')
  await page.getByRole('button', { name: '登录工作台' }).click()
  const map = page.locator('.three-map-stage')
  await expect(map.locator('canvas')).toBeVisible()
  await map.getByRole('button', { name: /合肥南站，铁路站/ }).focus()
  await expect(map.getByRole('tooltip')).toContainText('铁路发送人次：')
  await expect(map.getByRole('tooltip')).not.toContainText('静态样例')
  await expect(page.getByText('位置与数值为静态样例', { exact: true })).toHaveCount(0)
})

test('mobile map fits the page and keeps its controls usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const map = await enterMap(page)
  await map.scrollIntoViewIfNeeded()
  await expect(map.getByRole('button', { name: '放大地图', exact: true })).toBeVisible()
  await map.getByRole('button', { name: '切换俯视与立体视角' }).click()
  await expect(map.getByRole('button', { name: '切换俯视与立体视角' })).toHaveText('立体')
  expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth + 2)).toBe(true)
  await page.screenshot({ path: 'test-results/map-390.png', fullPage: true })
})
