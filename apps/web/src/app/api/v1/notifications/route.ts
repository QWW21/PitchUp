/**
 * GET /api/v1/notifications?cursor=&limit=&unreadOnly= — E08-09, E13-06. The
 * signed-in user's notifications, newest first, with the unread count for a
 * badge.
 */
import type { NextRequest } from 'next/server'
import { NotificationListQuerySchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateQuery } from '@/lib/api/validate'
import { listNotifications } from '@/lib/profile/notifications'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const query = validateQuery(request, NotificationListQuerySchema)
    if (query.error) return query.error
    return ok(
      await listNotifications(
        session.user.id,
        query.data.cursor,
        query.data.limit,
        query.data.unreadOnly
      )
    )
  })
)
