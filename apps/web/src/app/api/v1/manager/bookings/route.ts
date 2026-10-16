/** GET /api/v1/manager/bookings — C-8. Upcoming and last week's bookings of the manager's venue. */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireManager } from '@/lib/onboarding/guard'
import { activeCompany, listManagerBookings } from '@/lib/manager/bookings'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireManager(async (_request, session) => {
    const company = await activeCompany(session.user.id)
    const response = ok(await listManagerBookings(company.id))
    response.headers.set('Cache-Control', 'no-store')
    return response
  })
)
