/**
 * GET /api/v1/reviews/mine — E07-02. The signed-in player's reviews, newest
 * first, each with whether it can still be edited (server clock).
 */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { listMyReviews } from '@/lib/reviews/mine'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (_request, session) => ok(await listMyReviews(session.user.id)))
)
