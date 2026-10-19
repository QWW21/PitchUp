/**
 * GET/PUT /api/v1/manager/settings/payments — C-8. How players pay this
 * venue: online, online or at the venue, or at the venue only; and the
 * online deposit for paying at the venue (0–50%).
 */
import { VenuePaymentSettingsSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { requireManager } from '@/lib/onboarding/guard'
import { activeCompany, savePaymentSettings } from '@/lib/manager/bookings'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireManager(async (_request, session) => {
    const c = await activeCompany(session.user.id)
    return ok({ paymentMode: c.paymentMode, depositPercent: c.depositPercent })
  })
)

export const PUT = withErrorHandling(
  requireManager(async (request, session) => {
    const body = await validateBody(request, VenuePaymentSettingsSchema)
    if (body.error) return body.error
    const c = await activeCompany(session.user.id)
    return ok(await savePaymentSettings(c.id, body.data))
  })
)
