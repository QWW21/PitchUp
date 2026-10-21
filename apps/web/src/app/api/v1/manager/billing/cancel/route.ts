/** POST /api/v1/manager/billing/cancel — C-15. Ends the subscription when the paid period does. */
import { ok } from '@/lib/api/response'
import { cancel, getBilling } from '@/lib/billing'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (_request, company) => {
  await cancel(company.id)
  return ok(await getBilling(company.id))
})
