import { expect, it } from 'vitest'
import { createInteractions } from '../../web_interactions/src/module'
import { normalizeForecast } from '../../web_interactions/src/api/forecast'
import { createDemoApi } from '../../web_interactions/dev/mock'
import { dashboardDemo } from '../../web_dashboard/src/app/demo-api'
import { resolveEntityRoute, parseAnalysisIds } from '../../web_dashboard/src/app/integration'
import { DEMO_SCENIC_IDS } from '../../web_dashboard/src/app/demo'
import type { ComparisonResult } from '../../web_dashboard/src/app/types'
const make = () => createInteractions({resolveEntityRoute, fetcher:createDemoApi('normal',dashboardDemo('normal'))})
it('routes scenic, rail and unknown identities without default substitution', async()=>{
 const app=make();await app.auth.login('demo','demo2026')
 expect(await app.resolveEntityRoute(DEMO_SCENIC_IDS.huangshan)).toEqual({name:'scenic',query:{id:DEMO_SCENIC_IDS.huangshan}})
 expect(await app.resolveEntityRoute('10000000-0000-4000-8000-000000000001')).toMatchObject({name:'b-transport'})
 expect(await app.resolveEntityRoute('unknown')).toBeNull()
})
it('reads additional catalog pages',async()=>{
 const urls:string[]=[]
 const app=createInteractions({resolveEntityRoute,fetcher:async(url)=>{
  urls.push(url);return new Response(JSON.stringify({data:url.includes('page=2')?[{id:'scenic-2',type:'scenic'}]:Array.from({length:100},(_,i)=>({id:String(i),type:'airport'})),meta:{request_id:'test',total:101}}))
 }})
 expect(await app.resolveEntityRoute('scenic-2')).toMatchObject({name:'scenic'})
 expect(urls).toHaveLength(2)
})
it.each([
 [{lower:0,upper:10},{lower_bound:0,upper_bound:10}],
 [{lower_bound:2,upper_bound:9,lower:1,upper:10},{lower_bound:2,upper_bound:9}],
 [{lower_bound:null,upper_bound:null,lower:1,upper:10},{lower_bound:null,upper_bound:null}],
 [{},{lower_bound:null,upper_bound:null}],
])('normalizes forecast bounds without fabricating absent values', (point,expected)=>{
 expect(normalizeForecast({forecast_points:[point]})).toEqual({forecast_points:[expected]})
})
it('normalizes legacy bounds at the shared client boundary',async()=>{
 const app=createInteractions({fetcher:async()=>new Response(JSON.stringify({data:{forecast_points:[{lower:1,upper:2}]},meta:{request_id:'test'}}))})
 expect((await app.client.request('/forecasts/history')).data).toEqual({forecast_points:[{lower_bound:1,upper_bound:2}]})
})
it('validates runtime analysis configuration',()=>{
 const ids={'40000000-0000-4000-8000-000000000001':'60000000-0000-4000-8000-000000000001'}
 expect(parseAnalysisIds(JSON.stringify(ids))).toEqual(ids)
 expect(parseAnalysisIds()).toEqual({})
 expect(()=>parseAnalysisIds('{"video":"invalid"}')).toThrow()
 expect(()=>parseAnalysisIds('[]')).toThrow()
})
it('compares two scenic series and validates metric compatibility',async()=>{
 const app=make();await app.auth.login('demo','demo2026')
 const body={series:Object.values(DEMO_SCENIC_IDS).map(entity_id=>({entity_id,metric:'scenic_visits'})),grain:'month',start:'2026-01-01',end:'2026-09-30',display_mode:'separate_axes'}
 const result=(await app.client.post<ComparisonResult>('/analytics/compare',body)).data
 expect(result.series).toHaveLength(2);expect(result.series[0].points).toHaveLength(9)
 expect(result.series[0].points[0].value).not.toBe(result.series[1].points[0].value)
 await expect(app.client.post('/analytics/compare',{...body,series:body.series.map(s=>({...s,metric:'rail_departures'}))})).rejects.toMatchObject({status:422})
})
