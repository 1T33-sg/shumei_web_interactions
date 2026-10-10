export function normalizeForecast(data: unknown): unknown {
 if (!data || typeof data !== 'object' || !('forecast_points' in data) || !Array.isArray(data.forecast_points)) return data
 return { ...data, forecast_points: data.forecast_points.map((point: unknown) => {
  if (!point || typeof point !== 'object') return point
  const p = point as Record<string, unknown>
  const { lower, upper, ...rest } = p
  return { ...rest, lower_bound: 'lower_bound' in p ? p.lower_bound : lower ?? null, upper_bound: 'upper_bound' in p ? p.upper_bound : upper ?? null }
 }) }
}
