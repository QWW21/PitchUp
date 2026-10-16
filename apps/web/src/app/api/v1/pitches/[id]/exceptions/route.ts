/**
 * POST /api/v1/pitches/:id/exceptions — E10-04. Blocks a date (today or
 * later). 409 HAS_BOOKINGS with their ids when the date has bookings.
 */
import { PitchExceptionSchema } from '@pitchup/shared'
import { created } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { addException } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const POST = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, PitchExceptionSchema)
  if (body.error) return body.error
  return created(await addException(company.id, id!, body.data))
})
