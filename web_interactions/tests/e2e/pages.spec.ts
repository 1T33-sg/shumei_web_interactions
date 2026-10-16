import { test, expect, type Page } from '@playwright/test'
import { createDemoApi } from '../../dev/mock'
import { analysisId, videos } from '../../dev/fixtures'
import { syntheticJobIds, syntheticChunkId, syntheticDocumentId } from '../../dev/synthetic'
import { fileURLToPath } from 'node:url'

type Overrides = { countStatus?: number; assistantStatus?: number; metricStrings?: boolean; legacy?: boolean; manual?: boolean }
async function setup(page: Page, path: string, scenario = 'p2pnet', overrides: Overrides = {}) {
  const mock = createDemoApi(overrides.legacy ? 'normal' : scenario)
  const requests: { path: string; body: Record<string, unknown> | null; headers: Record<string, string> }[] = []
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    requests.push({ path: url.pathname, body: request.postDataJSON(), headers: request.headers() })
    const status = url.pathname.endsWith('/counts') ? overrides.countStatus : url.pathname.endsWith('/assistant/chat') ? overrides.assistantStatus : undefined
    if (status) { await route.fulfill({ status, json: { error: { code: status === 409 ? 'analysis_not_ready' : status === 503 ? 'dependency_not_available' : 'forbidden', message: 'synthetic test failure', details: {} }, request_id: 'synthetic-test' } }); return }
    const response = await mock(request.url(), { method: request.method(), body: request.postData() ?? undefined, headers: request.headers() })
    const payload = await response.json()
    if (url.pathname.endsWith('/counts') && payload.data && !overrides.legacy) {
      payload.data.weights_version = 'leader-SHTechA-50604773'
      if (overrides.manual) payload.data.manual_validation = { sample_count: 8, mae: 1.5 }
    }
    if (url.pathname.endsWith('/assistant/chat') && payload.data && overrides.metricStrings) payload.data.used_metric_queries = ['query-opaque-no-entity-target']
    await route.fulfill({ status: response.status, json: payload })
  })
  await page.goto(path)
  await page.getByLabel('用户名', { exact: true }).fill('demo')
  await page.locator('#password').fill('demo2026')
  await page.getByRole('button', { name: '登录工作台' }).click()
  await expect(page.locator('h1')).toBeVisible()
  return requests
}
async function associate(page: Page) {
  await page.getByLabel('分析结果编号', { exact: true }).fill(analysisId)
  await page.getByRole('button', { name: '关联分析结果', exact: true }).click()
}
async function ask(page: Page, question = '这份公告适用于什么时候？') {
  await page.getByLabel('输入问题', { exact: true }).fill(question)
  await page.getByRole('button', { name: '发送', exact: true }).click()
}
async function seek(page: Page, value: number) {
  await page.locator('#replay-position').evaluate((node: HTMLInputElement, seconds) => { node.value = String(seconds); node.dispatchEvent(new Event('input', { bubbles: true })) }, value)
}
test('P2PNet reads D ROI and frame timestamps; missing and zero remain distinct', async ({ page }) => {
  const requests = await setup(page, '/video')
  await expect(page.locator('.analysis-status')).toContainText('未开始')
  await associate(page)
  await expect(page.locator('.count-metadata')).toContainText('P2PNet')
  await expect(page.locator('.count-metadata')).toContainText('leader-SHTechA-50604773')
  await expect(page.locator('.count-metadata')).toContainText('pytorch / CPU')
  await expect(page.locator('.count-metadata')).toContainText('0.5')
  await expect(page.locator('.count-metadata')).toContainText('median')
  await expect(page.locator('.count-item strong')).toHaveText('1.5人')
  await expect(page.locator('.counter-panel')).toContainText('未人工评估')
  await seek(page, 300); await expect(page.locator('.count-item strong')).toHaveText('0人')
  await seek(page, 600); await expect(page.locator('.count-item strong')).toHaveText('缺测')
  await expect(page.locator('.counter-panel')).toContainText('0 帧')
  await page.getByRole('combobox', { name: '计数粒度' }).click(); await page.getByRole('option', { name: '逐帧估计' }).click()
  await expect(page.locator('.counter-panel')).toContainText('最近帧人数')
  await expect(page.locator('.analysis-status')).toContainText('可用')
  expect(new URL(requests.filter(r => r.path.endsWith('/counts')).at(-1)!.path, 'http://test').pathname).toContain('/counts')
})
test('short forecasts are future 5-minute estimates, no interval shade for null bounds, 60 closed', async ({ page }) => {
  await setup(page, '/video'); await associate(page)
  await expect(page.locator('.count-metadata')).toBeVisible()
  await page.getByRole('combobox', { name: '预测时长' }).click()
  await expect(page.getByRole('option', { name: '未来 60 分钟' })).toHaveCount(0)
  await page.getByRole('option', { name: '未来 30 分钟' }).click()
  await page.getByRole('button', { name: '短时预测', exact: true }).click()
  await expect(page.locator('.chart-footer')).toContainText('synthetic-forecast-not-trained')
  await expect(page.getByText('预测区间', { exact: true })).toHaveCount(0)
  await expect(page.locator('.video-trend-panel tbody tr').filter({ has: page.getByRole('cell', { name: '预测', exact: true, includeHidden: true }) })).toHaveCount(6)
})
test('insufficient forecast is an empty chart with its reason, never reused history', async ({ page }) => {
  await setup(page, '/video', 'p2pnet-insufficient'); await associate(page)
  await expect(page.locator('.count-metadata')).toBeVisible()
  await page.getByRole('button', { name: '短时预测', exact: true }).click()
  await expect(page.getByText('synthetic：有效历史不足，未生成预测。', { exact: true })).toBeVisible()
  await expect(page.locator('.video-trend-panel .trend-chart')).toHaveCount(0)
})
for (const outcome of ['failed', 'not-ready']) test(`published job route: queued -> running -> ${outcome}`, async ({ page }) => {
  const requests = await setup(page, '/video', `p2pnet-queued-${outcome}`); await associate(page)
  await expect(page.locator('.analysis-status')).toContainText('结果未就绪')
  await page.locator('.analysis-admin summary').click()
  await page.getByLabel('作业编号', { exact: true }).fill(syntheticJobIds[analysisId]!)
  await page.getByRole('button', { name: '读取作业状态', exact: true }).click()
  await expect(page.locator('.analysis-status')).toContainText('排队中')
  await expect(page.locator('.analysis-status')).toContainText('处理中', { timeout: 10000 })
  await expect(page.locator('.analysis-status')).toContainText(outcome === 'failed' ? '失败' : '结果未就绪', { timeout: 10000 })
  await expect(page.locator('.count-item strong')).toHaveText('缺测')
  expect(requests.filter(r => r.path.includes('/jobs/')).every(r => r.path === `/api/v1/jobs/${syntheticJobIds[analysisId]}`)).toBe(true)
})
test('admin request 26 sends fixed public fields and CSRF, omits confidence_threshold', async ({ page }) => {
  const requests = await setup(page, '/video')
  await page.locator('.analysis-admin summary').click()
  await page.getByLabel('已确认的 ROI 顶点', { exact: true }).fill('[[0,0],[1,0],[1,1]]')
  await page.getByRole('button', { name: '提交 P2PNet 分析', exact: true }).click()
  await expect(page.locator('.count-metadata')).toBeVisible()
  const request = requests.find(r => r.path.endsWith('/analyses'))!
  expect(request.body).toEqual({ count_model: 'p2pnet', weights_version: 'leader-SHTechA-50604773', roi: { points: [[0, 0], [1, 0], [1, 1]] }, sample_interval_seconds: 10, aggregation_minutes: 5, inference_engine: 'pytorch', device: 'CPU' })
  expect(request.headers['x-csrf-token']).toBe('demo-csrf')
})
test('citations preserve document/chunk identities, expiry and allowed snippets without invented links', async ({ page }) => {
  const requests = await setup(page, '/assistant', 'p2pnet', { metricStrings: true }); await ask(page)
  await expect(page.locator('.evidence-citation')).toContainText(syntheticChunkId)
  await expect(page.locator('.evidence-citation')).toContainText('适用期已结束')
  await expect(page.locator('.query-context')).toContainText('query-opaque-no-entity-target')
  await expect(page.getByRole('button', { name: '查看图表' })).toHaveCount(0)
  await page.getByRole('button', { name: '查看资料', exact: true }).click()
  await expect(page.locator('.b-drawer')).toContainText('不能证明当前开放时间或人数')
  await expect(page.locator('.b-drawer')).toContainText('未提供片段与页码')
  expect(requests.some(r => r.path === `/api/v1/knowledge/documents/${syntheticDocumentId}`)).toBe(true)
})
test('index pending is distinct from insufficient evidence', async ({ page }) => {
  await setup(page, '/assistant', 'p2pnet-index'); await ask(page)
  await expect(page.locator('.evidence-citation')).toContainText('索引未就绪')
  await ask(page, '现在有多少人？')
  await expect(page.locator('.exchange').last()).toContainText('证据不足')
})
for (const status of [403, 503]) test(`assistant ${status} never fabricates an answer`, async ({ page }) => {
  await setup(page, '/assistant', 'p2pnet', { assistantStatus: status }); await ask(page)
  await expect(page.locator('.answer-body')).toContainText(status === 403 ? '无权' : '依赖不可用')
  await expect(page.locator('.answer-text')).toHaveCount(0)
})
test('historical DM model remains identified as historical; available evaluation displays samples and MAE', async ({ page }) => {
  await setup(page, '/video', 'normal', { legacy: true }); await associate(page)
  await expect(page.locator('.count-metadata')).toContainText('历史 DM-Count')
  await expect(page.locator('.counter-panel')).toContainText('12 帧 · MAE 3.6 人')
})
for (const status of [401, 403, 409, 503]) test(`video ${status} shows no zero count`, async ({ page }) => {
  await setup(page, '/video', 'p2pnet', { countStatus: status }); await associate(page)
  if (status === 401) await expect(page).toHaveURL(/login/)
  else { await expect(page.locator('.video-page')).toContainText(status === 403 ? '无权' : status === 409 ? '结果未就绪' : '依赖服务不可用'); await expect(page.locator('.count-item strong')).toHaveText('缺测') }
})
for (const width of [1920, 390]) test(`B pages fit viewport ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 })
  await setup(page, '/video'); await associate(page)
  await expect(page.locator('.count-metadata')).toBeVisible()
  expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth + 2)).toBe(true)
  await page.screenshot({ path: fileURLToPath(new URL(`../../test-results/video-${width}.png`, import.meta.url)), fullPage: true })
  await page.goto('/assistant'); await ask(page)
  await expect(page.locator('.evidence-citation')).toContainText('适用期已结束')
  expect(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth + 2)).toBe(true)
  await page.screenshot({ path: fileURLToPath(new URL(`../../test-results/assistant-${width}.png`, import.meta.url)), fullPage: true })
})
