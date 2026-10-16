/**
 * GET /api/v1/manager/analytics/export — E14-05. Every booking of the
 * period with what it earned, as CSV (at most 10,000 rows; X-Truncated:
 * true when cut). Query: period, pitchId.
 */
import { NextResponse } from 'next/server'
import { AnalyticsQuerySchema } from '@pitchup/shared'
import { validateQuery } from '@/lib/api/validate'
import { analyticsCsv } from '@/lib/manager/analytics'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const GET = managerRoute(async (request, company) => {
  const query = validateQuery(request, AnalyticsQuerySchema)
  if (query.error) return query.error
  const { csv, truncated, filename } = await analyticsCsv(
    company.id,
    query.data.period,
    query.data.pitchId
  )
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      ...(truncated ? { 'X-Truncated': 'true' } : {}),
    },
  })
})
