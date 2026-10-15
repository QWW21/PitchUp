/**
 * GET /api/v1/profile/trust-score?cursor=&limit= — E08-02. The score, its
 * tier and what the tier allows, the history newest first (cursor-paged),
 * and the table of all tiers.
 */
import type { NextRequest } from 'next/server'
import { NotificationListQuerySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { getTrustScore } from '@/lib/profile/account'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    // The same cursor + clamped limit as the notification list.
    const query = validateQuery(request, NotificationListQuerySchema)
    if (query.error) return query.error
    return ok(await getTrustScore(session.user.id, query.data.cursor, query.data.limit))
  })
)
