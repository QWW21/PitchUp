/**
 * GET /api/v1/manager/pitches/:id/availability-gaps?date=YYYY-MM-DD — E11-05.
 * The stretches of the day the pitch is open with nothing booked.
 */
import { z } from 'zod'
import { ok } from '@/lib/api/response'
import { validateQuery } from '@/lib/api/validate'
import { availabilityGaps } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

const Query = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD') })

export const GET = managerRoute(async (request, company, { id }) => {
  const query = validateQuery(request, Query)
  if (query.error) return query.error
  return ok({ gaps: await availabilityGaps(company.id, id!, query.data.date) })
})
