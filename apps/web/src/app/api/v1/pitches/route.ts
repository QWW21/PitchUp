/**
 * POST /api/v1/pitches — E10-01. A venue manager adds a pitch; it starts
 * inactive. 201 { id, name, isActive } · 400 · 403 NOT_ACTIVE.
 */
import { PitchBasicInfoSchema } from '@pitchup/shared'
import { created } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { createPitch } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const POST = pitchRoute(async (request, company) => {
  const body = await validateBody(request, PitchBasicInfoSchema)
  if (body.error) return body.error
  return created(await createPitch(company.id, body.data))
})
