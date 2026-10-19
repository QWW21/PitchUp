/**
 * GET /api/v1/manager/analytics/pitches — E14-03. One row per pitch: revenue, bookings, occupancy, cancellations, no-shows, rating.
 * Query: period (7d, 30d, 90d, 12m; default 30d), pitchId (optional).
 */
import { AnalyticsQuerySchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateQuery } from '@/lib/api/validate'
import { analyticsPitches } from '@/lib/manager/analytics'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const GET = managerRoute(async (request, company) => {
  const query = validateQuery(request, AnalyticsQuerySchema)
  if (query.error) return query.error
  return ok(await analyticsPitches(company.id, query.data.period))
})
