/**
 * GET /api/v1/manager/bookings — E11-01. The venue's bookings, newest
 * first, filtered by pitch, status, dates (venue days) and player name or
 * email; cursor pages of up to 100. 400 for a bad filter.
 */
import { ManagerBookingQuerySchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateQuery } from '@/lib/api/validate'
import { listManagerBookings } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const GET = managerRoute(async (request, company) => {
  const query = validateQuery(request, ManagerBookingQuerySchema)
  if (query.error) return query.error
  const response = ok(await listManagerBookings(company.id, query.data))
  response.headers.set('Cache-Control', 'no-store')
  return response
})
