/**
 * GET /api/v1/manager/bookings/calendar?week=YYYY-MM-DD&pitchId= — E11-02.
 * One week (moved back to its Monday) of bookings as calendar events, with
 * each pitch's colour. Cancelled and abandoned bookings are left out.
 */
import { ManagerCalendarQuerySchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateQuery } from '@/lib/api/validate'
import { managerCalendar } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const GET = managerRoute(async (request, company) => {
  const query = validateQuery(request, ManagerCalendarQuerySchema)
  if (query.error) return query.error
  const response = ok(await managerCalendar(company.id, query.data.week, query.data.pitchId))
  response.headers.set('Cache-Control', 'no-store')
  return response
})
