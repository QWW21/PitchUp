/**
 * GET /api/v1/manager/pitches — E10-05. The manager's pitches with their
 * cover photo, rating, today's bookings and photo count.
 */
import { ok } from '@/lib/api/response'
import { listPitches } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const GET = pitchRoute(async (_request, company) => {
  const response = ok(await listPitches(company.id))
  response.headers.set('Cache-Control', 'no-store')
  return response
})
