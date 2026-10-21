/** GET /api/v1/manager/billing — C-15. The venue's subscription, its next bill and its prices. */
import { ok } from '@/lib/api/response'
import { getBilling } from '@/lib/billing'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const GET = managerRoute(async (_request, company) => ok(await getBilling(company.id)))
