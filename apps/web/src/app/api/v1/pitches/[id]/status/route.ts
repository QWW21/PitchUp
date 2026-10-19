/**
 * PATCH /api/v1/pitches/:id/status — E10-05. Activating needs a photo and a
 * price (400 NO_PHOTOS / NO_PRICE); deactivating never blocks.
 */
import { PitchStatusSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { setPitchStatus } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const PATCH = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, PitchStatusSchema)
  if (body.error) return body.error
  return ok(await setPitchStatus(company.id, id!, body.data.isActive))
})
