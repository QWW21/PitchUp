/**
 * GET/PUT /api/v1/manager/settings/bookings — C-10, C-13. Whether bookings
 * are confirmed automatically or each by hand, and the venue's refund
 * policy. Both apply to bookings made from now on.
 */
import { VenueBookingSettingsSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { managerRoute } from '@/lib/manager/manager-route'
import { bookingSettingsOf, saveBookingSettings } from '@/lib/manager/venue'

export const dynamic = 'force-dynamic'

export const GET = managerRoute(async (_request, company) => ok(bookingSettingsOf(company)))

export const PUT = managerRoute(async (request, company) => {
  const body = await validateBody(request, VenueBookingSettingsSchema)
  if (body.error) return body.error
  return ok(await saveBookingSettings(company.id, body.data))
})
