/**
 * PUT /api/v1/pitches/:id/pricing — E10-03 with C-2: one hourly rate, and
 * the shortest and longest booking and how far ahead it can be booked.
 */
import { PitchPricingSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { setPricing } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const PUT = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, PitchPricingSchema)
  if (body.error) return body.error
  return ok(await setPricing(company.id, id!, body.data))
})
