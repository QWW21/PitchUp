/** PATCH /api/v1/notifications/:id/read — E08-09. Someone else's: 404. */
import type { NextRequest } from 'next/server'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { markRead } from '@/lib/profile/notifications'

export const dynamic = 'force-dynamic'

export const PATCH = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    await markRead(session.user.id, request.nextUrl.pathname.split('/').at(-2) ?? '')
    return ok({ read: true })
  })
)
