import { test, expect } from '@playwright/test'
const routes = ['/', '/scenic', '/holidays', '/transport', '/events', '/assistant', '/video']
async function enter(page: import('@playwright/test').Page, path = '/') {
 await page.goto(path); await expect(page.getByRole('button', { name: '进入演示工作台' })).toBeVisible()
 await page.getByRole('button', { name: '进入演示工作台' }).click()
 await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible()
}
for (const path of routes) test(`login returns to ${path}; refresh and logout`, async ({ page }) => {
 await enter(page,path); await expect(page).toHaveURL(new RegExp(path === '/' ? '/$' : `${path}$`))
 await page.reload(); await expect(page.getByRole('button',{ name: '进入演示工作台' })).toBeVisible()
 await page.getByRole('button',{ name: '进入演示工作台' }).click()
 await page.getByRole('button',{ name: '退出登录' }).click(); await expect(page).toHaveURL(/login/)
})
for (const size of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844}]) test(`seven pages at ${size.width}`, async ({page}) => {
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize(size);await enter(page)
 const links=page.getByRole('navigation',{name:'主导航'}).getByRole('link')
 for(let i=0;i<7;i++) {await links.nth(i).click();await page.waitForTimeout(600);expect(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2)).toBe(true)}
 await page.screenshot({path:`test-results/layout-${size.width}.png`,fullPage:true});expect(errors).toEqual([])
})
test('map missing configuration and transport interaction', async ({ page }) => {
 await enter(page);await expect(page.getByText('请先在 .env.local 配置高德 Key 和安全密钥。')).toBeVisible()
 await page.getByRole('link',{name:/交通客流/}).click();await expect(page.getByRole('button',{name:'生成预测'})).toBeVisible()
 await page.getByRole('button',{name:'问问智能助手'}).click();await expect(page).toHaveURL(/assistant/)
})

test('events, citations and video forecasts', async ({ page }) => {
 await enter(page,'/events')
 await page.getByRole('button',{name:/合肥南站发送量波动提示/}).click()
 await expect(page.getByText('事件时间线')).toBeVisible()
 await page.getByRole('button',{name:'查看关联对象'}).click()
 await expect(page).toHaveURL(/transport.*entity_id/)
 await page.getByRole('button',{name:'问问智能助手'}).click()
 await page.getByRole('button',{name:'发送',exact:true}).click()
 await expect(page.getByText('参考来源',{exact:true})).toBeVisible()
 await page.getByRole('link',{name:/录像回放/}).click()
 await expect(page.getByRole('combobox',{name:'计数粒度'})).toBeVisible()
 await page.getByRole('button',{name:'短时预测',exact:true}).click()
 await expect(page.locator('.chart-footer')).toContainText('demo-damped-trend-simulated-v1')
 await expect(page.locator('.video-trend-panel tbody tr').filter({has:page.getByRole('cell',{name:'预测',exact:true,includeHidden:true})})).toHaveCount(6)
 await page.locator('#replay-position').evaluate((input:HTMLInputElement)=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}))})
 await page.getByRole('button',{name:'短时预测',exact:true}).click()
 await expect(page.getByText('模拟场景：截止位置前需要约 120 分钟有效画面人数，当前历史不足',{exact:true})).toBeVisible()
 await expect(page.getByText('截止位置前尚无完整计数点，请向后移动时间轴。缺失人数不会补零。',{exact:true})).toBeVisible()
})
test('invalid login and unsafe redirect', async ({page}) => {
 await page.goto('/login?redirect=https://example.org')
 await page.getByLabel('用户名',{exact:true}).fill('demo')
 await page.locator('#password').fill('wrongpass')
 await page.getByRole('button',{name:'登录工作台'}).click()
 await expect(page.getByText(/演示账号为 demo/)).toBeVisible()
 await page.getByRole('button',{name:'进入演示工作台'}).click()
 await expect(page).toHaveURL('http://127.0.0.1:5183/')
})

test('scenic and holiday filters', async ({page}) => {
 await enter(page,'/scenic')
 await page.getByRole('button',{name:'选择景区',exact:true}).click()
 await page.getByRole('option',{name:'九华山风景区'}).click()
 await expect(page.locator('.scenic-summary')).toContainText('九华山')
 await page.getByRole('link',{name:/假期专题/}).click()
 await page.getByRole('button',{name:'假期类型',exact:true}).click()
 await page.getByRole('option',{name:'国庆',exact:true}).click()
 await page.getByRole('button',{name:'比较方式',exact:true}).click()
 await page.getByRole('option',{name:'假期总量',exact:true}).click()
 await expect(page.locator('.state-box').filter({hasText:'两个假期天数不同'})).toBeVisible()
})
test('map entity navigation with component stub', async ({page}) => {
 await page.route(/\/src\/components\/map\/AnhuiMap\.vue$/, async route => {
  const response=await route.fetch();const source=await response.text()
  const vue=source.match(/from\s+["']([^"']*vue[^"']*)["']/)?.[1]
  if(!vue)throw new Error('Vue module import missing')
  await route.fulfill({contentType:'application/javascript',body:`import {h} from ${JSON.stringify(vue)};export default {props:['entities'],emits:['select'],setup(props,{emit}){return ()=>h('div',props.entities.map(e=>h('button',{onClick:()=>emit('select',e)},e.name)))}}`})
 })
 await enter(page)
 await page.getByRole('button',{name:'合肥南站',exact:true}).click()
 await expect(page).toHaveURL(/transport\?entity_id=10000000/)
 await expect(page.getByRole('button',{name:'生成预测'})).toBeVisible()
})
