/** GET /api/v1/notifications/count — E13-06. `{ unread }`, for a badge that polls. */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { unreadCount } from '@/lib/profile/notifications'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (_request, session) => {
    const response = ok({ unread: await unreadCount(session.user.id) })
    response.headers.set('Cache-Control', 'no-store')
    return response
  })
)
