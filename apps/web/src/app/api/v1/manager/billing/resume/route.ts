/** POST /api/v1/manager/billing/resume — C-15. Keeps a cancelled subscription after all. */
import { ok } from '@/lib/api/response'
import { getBilling, resume } from '@/lib/billing'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (_request, company) => {
  await resume(company.id)
  return ok(await getBilling(company.id))
})
