/** PATCH /api/v1/notifications/read-all — E08-09. → { updated } */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { markAllRead } from '@/lib/profile/notifications'

export const dynamic = 'force-dynamic'

export const PATCH = withErrorHandling(
  requireAuth(async (_request, session) => ok({ updated: await markAllRead(session.user.id) }))
)
