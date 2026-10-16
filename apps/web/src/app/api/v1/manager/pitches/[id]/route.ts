/** GET /api/v1/manager/pitches/:id — E10. Everything the pitch editor shows. */
import { ok } from '@/lib/api/response'
import { getManagerPitch } from '@/lib/manager/pitches'
import { pitchRoute } from '@/lib/manager/pitch-route'

export const dynamic = 'force-dynamic'

export const GET = pitchRoute(async (_request, company, { id }) => {
  const response = ok(await getManagerPitch(company.id, id!))
  response.headers.set('Cache-Control', 'no-store')
  return response
})
