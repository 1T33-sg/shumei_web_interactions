import { test, expect } from '@playwright/test'
test('API mode shares login and does not fall back to samples on failures', async ({page}) => {
 let signedIn=false, businessStatus=503
 await page.route('**/api/v1/**', async route => {
  const path=new URL(route.request().url()).pathname
  if(path.endsWith('/auth/login'))signedIn=true
  if(path.endsWith('/auth/logout'))signedIn=false
  const auth=path.includes('/auth/')
  const status=auth ? (signedIn || path.endsWith('/auth/logout') ? 200 : 401) : businessStatus
  const data=path.endsWith('/auth/logout') ? {logged_out:true} : {user:{id:'test',username:'test',display_name:'测试',role:'viewer'},csrf_token:'test-token',expires_at:'2099-01-01'}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200 ? {data,meta:{request_id:'test'}} : {error:{code:'test_error',message:`测试接口错误 ${status}`}})})
 })
 await page.goto('http://127.0.0.1:5174/scenic')
 await expect(page.getByRole('button',{name:'进入演示工作台'})).toHaveCount(0)
 await page.getByLabel('用户名',{exact:true}).fill('tester');await page.locator('#password').fill('testpassword')
 await page.getByRole('button',{name:'登录工作台'}).click()
 await expect(page).toHaveURL('http://127.0.0.1:5174/scenic')
 await expect(page.getByText('测试接口错误 503')).toBeVisible()
 await expect(page.getByText('演示数据',{exact:true})).toHaveCount(0)
 businessStatus=422;await page.getByRole('link',{name:/交通客流/}).click()
 await expect(page.getByText('测试接口错误 422')).toBeVisible()
 businessStatus=401;await page.getByRole('link',{name:/事件中心/}).click()
 await expect(page).toHaveURL(/login/)
 await expect(page.getByText('会话已结束，请重新登录。')).toBeVisible()
})
