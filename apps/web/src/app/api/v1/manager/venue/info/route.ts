/**
 * PUT /api/v1/manager/venue/info — C-13. Proposes new name, description, logo and links for an
 * approved venue. They wait for an admin; the page keeps the current ones.
 */
import { CompanyInfoSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { managerRoute } from '@/lib/manager/manager-route'
import { proposeVenueChange } from '@/lib/manager/venue'

export const dynamic = 'force-dynamic'

export const PUT = managerRoute(async (request, company) => {
  const body = await validateBody(request, CompanyInfoSchema)
  if (body.error) return body.error
  return ok(await proposeVenueChange(company, { section: 'info', input: body.data }))
})
