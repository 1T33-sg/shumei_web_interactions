import { test, expect } from '@playwright/test'
import { createDemoApi } from '../../web_interactions/dev/mock'
import { dashboardDemo } from '../../web_dashboard/src/app/demo-api'
import { DEMO_SCENIC_IDS } from '../../web_dashboard/src/app/demo'
import { analysisId } from '../../web_interactions/dev/fixtures'
const scenicId=DEMO_SCENIC_IDS.jiuhua
async function api(page:import('@playwright/test').Page, options:{unavailable?:boolean}={}) {
 const fetcher=createDemoApi('normal',dashboardDemo('normal'))
 await page.route('**/api/v1/**',async route=>{
  const request=route.request(), url=request.url()
  const response=await fetcher(url,{method:request.method(),headers:request.headers(),body:request.postData() ?? undefined})
  const payload=await response.json()
  if(/\/events\/[^/?]+$/.test(url)&&payload.data)payload.data.affected_entity_ids=[scenicId]
  if(url.endsWith('/assistant/chat')&&payload.data)payload.data.used_metric_queries[0].entity_id=scenicId
  if(url.includes('/counts?') && options.unavailable) {await route.fulfill({status:409,json:{error:{code:'analysis_not_ready',message:'分析结果尚未就绪'}}});return}
  await route.fulfill({status:response.status,json:payload})
 })
}
async function login(page:import('@playwright/test').Page,path:string){
 await page.goto('http://127.0.0.1:5184'+path)
 await page.getByLabel('用户名',{exact:true}).fill('demo');await page.locator('#password').fill('demo2026')
 await page.getByRole('button',{name:'登录工作台'}).click()
 await expect(page.getByRole('navigation',{name:'主导航'})).toBeVisible()
}
test('event scenic object opens A scenic page',async({page})=>{
 await api(page);await login(page,'/events')
 await page.getByRole('button',{name:/合肥南站发送量波动提示/}).click()
 await page.getByRole('button',{name:'查看关联对象'}).click()
 await expect(page).toHaveURL(new RegExp('/scenic\\?id='+scenicId))
 await expect(page.locator('.scenic-summary')).toContainText('九华山')
})
test('assistant scenic query opens A scenic page',async({page})=>{
 await api(page);await login(page,'/assistant')
 await page.locator('textarea').fill('分析交通趋势');await page.getByRole('button',{name:'发送',exact:true}).click()
 await page.getByRole('button',{name:'查看图表'}).click()
 await expect(page.locator('.scenic-summary')).toContainText('九华山')
})
test('API video associates known analysis, handles 409 then predicts',async({page})=>{
 const state={unavailable:true};await api(page,state);await login(page,'/video')
 await page.getByLabel('分析结果编号',{exact:true}).fill('bad-id')
 await page.getByRole('button',{name:'关联分析结果'}).click();await expect(page.getByText('请输入有效的分析结果编号（UUID）',{exact:true})).toBeVisible()
 await page.getByLabel('分析结果编号',{exact:true}).fill(analysisId)
 await page.getByRole('button',{name:'关联分析结果'}).click();await expect(page.getByText('分析结果尚未就绪',{exact:true})).toBeVisible()
 state.unavailable=false
 await page.getByRole('button',{name:'关联分析结果'}).click()
 await page.getByRole('button',{name:'短时预测',exact:true}).click()
 await expect(page.getByText(/demo-short-v1/)).toBeVisible()
})
test('scenic comparison is available and resets after filter changes',async({page})=>{
 await page.goto('/scenic');await page.getByRole('button',{name:'进入演示工作台'}).click()
 await page.getByRole('button',{name:'生成对比'}).click()
 await expect(page.locator('.comparison-grid article')).toHaveCount(2)
 await expect(page.locator('.comparison-note')).toContainText('不相加')
 await page.getByRole('button',{name:'时间粒度',exact:true}).click();await page.getByRole('option',{name:'按周'}).click()
 await expect(page.locator('.comparison-grid')).toHaveCount(0)
})
