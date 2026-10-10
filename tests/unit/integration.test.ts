import { describe, it, expect } from 'vitest'
import { createInteractions, safeRedirect } from '../../web_interactions/src/module'
import { createDemoApi } from '../../web_interactions/dev/mock'
import { dashboardDemo } from '../../web_dashboard/src/app/demo-api'
const make = (scenario = 'normal') => createInteractions({ mode: 'demo', fetcher: createDemoApi(scenario, dashboardDemo(scenario)) })
describe('integrated authentication and data', () => {
 it('requires login, rejects wrong password, shares session and clears logout', async () => {
  const app = make(); expect(await app.auth.checkSession()).toBe(false)
  await expect(app.auth.login('demo','wrong')).rejects.toMatchObject({ status: 401 })
  await app.auth.login('demo','demo2026'); expect(await app.auth.checkSession()).toBe(true)
  expect((await app.client.get<any[]>('/catalog/entities?type=scenic')).data).toHaveLength(2)
  const overview = (await app.client.get<any>('/dashboard/overview?grain=month')).data
  const transport = (await app.client.get<any[]>('/catalog/entities?type=rail_station')).data
  expect(overview.cards[1].entity_id).toBe(transport[0].id)
  await app.auth.logout(); expect(app.auth.state.session).toBeNull()
  await expect(app.client.get('/dashboard/overview')).rejects.toMatchObject({ status: 401 })
 })
 it.each(['https://evil.test','//evil.test','/login','/unknown','/scenic\\evil','/%2f%2fevil'])('blocks unsafe redirect %s', value => {
  expect(safeRedirect(value, ['/', '/scenic'], '/')).toBe('/')
 })
 it('preserves registered internal query and independent default', () => {
  expect(safeRedirect('/scenic?entity_id=1', ['/', '/scenic'], '/')).toBe('/scenic?entity_id=1')
  expect(safeRedirect(null)).toBe('/transport')
 })
 it.each([['error',503],['expired',401],['invalid',422],['network',0]])('surfaces %s without sample fallback', async (scenario, status) => {
  const app = make(String(scenario)); await app.auth.login('demo','demo2026')
  await expect(app.client.get('/dashboard/overview')).rejects.toMatchObject({ status })
  if (status === 401) expect(app.auth.state.session).toBeNull()
 })
 it('returns empty and insufficient states', async () => {
  const app = make('empty'); await app.auth.login('demo','demo2026')
  expect((await app.client.get<any[]>('/catalog/entities')).data).toEqual([])
  const limited = make('insufficient'); await limited.auth.login('demo','demo2026')
  expect((await limited.client.post<any>('/forecasts/history',{ metric:'scenic_visits' })).data.status).toBe('data_insufficient')
 })
})
