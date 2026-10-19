/**
 * POST /api/v1/pitches/:id/photos — E10-02. Adds a photo already uploaded to
 * Cloudinary; at most 10 (400 PHOTO_LIMIT). The first photo is the cover.
 */
import { AddPitchPhotoSchema } from '@pitchup/shared'
import { created } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { addPhoto } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const POST = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, AddPitchPhotoSchema)
  if (body.error) return body.error
  return created(await addPhoto(company.id, id!, body.data))
})
