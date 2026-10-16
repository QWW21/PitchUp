/**
 * PUT /api/v1/manager/venue/location — C-13. Proposes new address and map pin for an
 * approved venue. They wait for an admin; the page keeps the current ones.
 */
import { CompanyLocationSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { managerRoute } from '@/lib/manager/manager-route'
import { proposeVenueChange } from '@/lib/manager/venue'

export const dynamic = 'force-dynamic'

export const PUT = managerRoute(async (request, company) => {
  const body = await validateBody(request, CompanyLocationSchema)
  if (body.error) return body.error
  return ok(await proposeVenueChange(company, { section: 'location', input: body.data }))
})
