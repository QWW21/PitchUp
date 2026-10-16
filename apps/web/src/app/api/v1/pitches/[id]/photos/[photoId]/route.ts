/**
 * DELETE /api/v1/pitches/:id/photos/:photoId — E10-02. Removes the photo (and
 * its Cloudinary image) and returns the rest, in order.
 */
import { ok } from '@/lib/api/response'
import { deletePhoto } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const DELETE = pitchRoute(async (_request, company, { id, photoId }) =>
  ok(await deletePhoto(company.id, id!, photoId!))
)
