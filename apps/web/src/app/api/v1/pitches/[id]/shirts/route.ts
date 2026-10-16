/**
 * PUT /api/v1/pitches/:id/shirts — E10-04 with C-1: lend shirts or not, and
 * sets per colour; always free. 409 SHIRTS_PROMISED when upcoming bookings
 * were promised more sets, unless `force`.
 */
import { PitchShirtsSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { setShirts } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const PUT = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, PitchShirtsSchema)
  if (body.error) return body.error
  return ok(await setShirts(company.id, id!, body.data))
})
