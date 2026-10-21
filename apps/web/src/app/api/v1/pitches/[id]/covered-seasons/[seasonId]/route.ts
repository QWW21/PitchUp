/** DELETE /api/v1/pitches/:id/covered-seasons/:seasonId — C-14. Bookings keep their price. */
import { ok } from '@/lib/api/response'
import { deleteCoveredSeason } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const DELETE = pitchRoute(async (_request, company, { id, seasonId }) => {
  await deleteCoveredSeason(company.id, id!, seasonId!)
  return ok({ deleted: true })
})
