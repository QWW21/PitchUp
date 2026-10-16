/**
 * GET /api/v1/onboarding/status — E09-05. Which onboarding steps are done
 * and which comes next, so the wizard can pick up where the manager left.
 */
import { ok, withErrorHandling } from '@/lib/api/response'
import { managerCompany, onboardingStatus } from '@/lib/onboarding/company'
import { requireManager } from '@/lib/onboarding/guard'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireManager(async (_request, session) =>
    ok(onboardingStatus(await managerCompany(session.user.id)))
  )
)
