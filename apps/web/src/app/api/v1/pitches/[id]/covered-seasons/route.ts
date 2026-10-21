/**
 * POST /api/v1/pitches/:id/covered-seasons — C-14. Covers the pitch from
 * startDate to endDate (inclusive). 400 COVERED_NEEDS_AIR without a covered
 * price, 409 SEASON_OVERLAP when it overlaps another season.
 */
import { CoveredSeasonSchema } from '@pitchup/shared'
import { created } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { addCoveredSeason } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const POST = pitchRoute(async (request, company, { id }) => {
  const body = await validateBody(request, CoveredSeasonSchema)
  if (body.error) return body.error
  return created(await addCoveredSeason(company.id, id!, body.data))
})
