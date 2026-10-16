/**
 * POST /api/v1/manager/bookings/:id/no-show — C-8, E11-04. From 30 minutes
 * to 4 hours after kick-off; the venue keeps what was paid online and the
 * player loses 20 trust points. Reporting again returns `alreadyMarked`.
 */
import { ReportNoShowSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { reportNoShow } from '@/lib/manager/bookings'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (request, company, { id }, managerId) => {
  const body = await validateBody(request, ReportNoShowSchema)
  if (body.error) return body.error
  return ok(await reportNoShow(company.id, managerId, id!, body.data.reason))
})
