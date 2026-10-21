/** PUT /api/v1/manager/billing/interval { interval } — C-15. Monthly or yearly from the next bill. */
import { BillingIntervalSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { changeInterval, getBilling } from '@/lib/billing'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const PUT = managerRoute(async (request, company) => {
  const body = await validateBody(request, BillingIntervalSchema)
  if (body.error) return body.error
  await changeInterval(company.id, body.data.interval)
  return ok(await getBilling(company.id))
})
