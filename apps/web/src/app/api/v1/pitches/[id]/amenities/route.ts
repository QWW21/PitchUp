/** PUT /api/v1/pitches/:id/amenities — E10-03. The whole set, replacing the old one. */
import { PitchAmenitiesSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { setAmenities } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const PUT = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, PitchAmenitiesSchema)
  if (body.error) return body.error
  return ok(await setAmenities(company.id, id!, body.data))
})
