/**
 * GET /api/v1/companies/:id/reviews?pitchId=&sort=newest|lowest|unanswered&q=&page=&limit=
 * E07-05. The company's manager (or an admin): every approved review on its
 * pitches, with the reply, its edit window and how often it was reported.
 */
import type { NextRequest } from 'next/server'
import { ManagerReviewQuerySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { listCompanyReviews } from '@/lib/reviews/manage'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireRole('MANAGER')(async (request: NextRequest, session) => {
    const query = validateQuery(request, ManagerReviewQuerySchema)
    if (query.error) return query.error
    const id = request.nextUrl.pathname.split('/').at(-2) ?? ''
    return ok(await listCompanyReviews(id, session.user, query.data))
  })
)
