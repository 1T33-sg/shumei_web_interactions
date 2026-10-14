import { test, expect, type Page } from '@playwright/test'

async function enter(page: Page, path = '/') {
  await page.goto(path)
  await page.getByRole('button', { name: '进入演示工作台' }).click()
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
}

const pages = [
  { path: '/transport', title: '交通客流', panel: '.stat-card' },
  { path: '/events', title: '事件中心', panel: '.event-row' },
  { path: '/assistant', title: '智能问答', panel: '.chat-panel' },
  { path: '/video', title: '录像回放', panel: '.replay-panel' },
]

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`B cards match host style and remain usable at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await enter(page)
    const hostPanel = page.locator('.metric-card').first()
    await expect(hostPanel).toBeVisible()
    const hostStyle = await hostPanel.evaluate(element => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, border: style.borderTopColor, radius: style.borderRadius }
    })
    for (const view of pages) {
      await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: new RegExp(view.title) }).click()
      const root = page.locator('section.b-ui.page-stack')
      await expect(root.getByRole('heading', { level: 1, name: view.title, exact: true })).toBeVisible()
      const panel = root.locator(view.panel).first()
      await expect(panel).toBeVisible()
      expect(await panel.evaluate(element => {
        const style = getComputedStyle(element)
        return { background: style.backgroundColor, border: style.borderTopColor, radius: style.borderRadius }
      })).toEqual(hostStyle)
      expect(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth + 2)).toBe(true)
      await page.screenshot({ path: `test-results/b-style-${view.path.slice(1)}-${viewport.width}.png`, fullPage: true })
    }
  })
}

test('transport dropdown and source drawer retain B styling outside the page', async ({ page }) => {
  await enter(page, '/transport')
  await page.getByRole('combobox', { name: '交通枢纽' }).click()
  const overlay = page.locator('.b-select-overlay')
  await expect(overlay).toBeVisible()
  expect(await overlay.evaluate(element => getComputedStyle(element).borderRadius)).toBe('0px')
  await page.getByRole('option', { name: '合肥新桥机场', exact: true }).click()
  await expect(page.locator('.stat-top').first()).toContainText('机场旅客吞吐量')
  await expect(page.locator('.definition-bar')).toContainText('不能与铁路发送量直接相加')
  await page.getByRole('button', { name: '查看来源' }).click()
  const drawer = page.locator('.b-ui.b-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('数据来源', { exact: true })).toBeVisible()
  await expect(drawer.getByText('本地演示数据集', { exact: true })).toBeVisible()
  await expect(drawer.getByText('数据覆盖', { exact: true })).toBeVisible()
})
