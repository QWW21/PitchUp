/** DELETE /api/v1/notifications/:id — E08-09. 204 · someone else's: 404. */
import { NextResponse, type NextRequest } from 'next/server'
import { withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { deleteNotification } from '@/lib/profile/notifications'

export const dynamic = 'force-dynamic'

export const DELETE = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    await deleteNotification(session.user.id, request.nextUrl.pathname.split('/').pop() ?? '')
    return new NextResponse(null, { status: 204 })
  })
)
