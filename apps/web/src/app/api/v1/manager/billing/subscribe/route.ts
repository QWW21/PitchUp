/**
 * POST /api/v1/manager/billing/subscribe { interval } — C-15. Starts the
 * subscription (the free month first, the first time). With Stripe, returns
 * the secret the card form confirms; in test mode it is running at once.
 */
import { BillingIntervalSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { getBilling, subscribe } from '@/lib/billing'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (request, company) => {
  const body = await validateBody(request, BillingIntervalSchema)
  if (body.error) return body.error
  const { clientSecret } = await subscribe(company.id, body.data.interval)
  return ok({ clientSecret, billing: await getBilling(company.id) })
})
