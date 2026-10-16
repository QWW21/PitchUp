/** DELETE /api/v1/pitches/:id/exceptions/:exceptionId — E10-04. Unblocks a date; past ones stay. */
import { ok } from '@/lib/api/response'
import { deleteException } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const DELETE = pitchRoute(async (_request, company, { id, exceptionId }) => {
  await deleteException(company.id, id!, exceptionId!)
  return ok({ deleted: true })
})
