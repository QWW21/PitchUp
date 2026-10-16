/**
 * GET /api/v1/manager/stats/today — E09-10. The overview's numbers for the
 * manager's own, approved venue. 403 NOT_ACTIVE before approval.
 */
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { managerCompany } from '@/lib/onboarding/company'
import { requireManager } from '@/lib/onboarding/guard'
import { managerStats } from '@/lib/manager/stats'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireManager(async (_request, session) => {
    const company = await managerCompany(session.user.id)
    if (company?.status !== 'ACTIVE') {
      return err('FORBIDDEN', 'Your venue is not approved yet', 403, { reason: 'NOT_ACTIVE' })
    }
    const response = ok(await managerStats(company.id))
    response.headers.set('Cache-Control', 'no-store')
    return response
  })
)
