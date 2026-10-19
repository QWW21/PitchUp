/**
 * PUT /api/v1/pitches/:id/photos/reorder — E10-02. Every photo id in the new
 * order, applied together; 409 OUT_OF_SYNC when the list has changed.
 */
import { ReorderPhotosSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { reorderPhotos } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const PUT = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, ReorderPhotosSchema)
  if (body.error) return body.error
  return ok(await reorderPhotos(company.id, id!, body.data.photoIds))
})
