/**
 * POST /api/v1/manager/bookings/:id/cancel — C-12, C-13. Declines a booking
 * waiting for the venue, or cancels a confirmed one before kick-off. The
 * player gets everything paid online back, loses no trust, and reads the
 * reason. Body: { reason }.
 */
import { ManagerCancelSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { cancelByVenue } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (request, company, { id }) => {
  const body = await validateBody(request, ManagerCancelSchema)
  if (body.error) return body.error
  return ok(await cancelByVenue(company.id, id!, body.data.reason))
})
