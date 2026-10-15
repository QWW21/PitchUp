/**
 * POST /api/v1/bookings/:id/cancel — E06-03. The player cancels; the refund
 * follows PRD §9.2. 200 { refundAmount, refundPercent, booking }
 * · 400 NOT_CANCELLABLE · 404 · 503 refund failed (nothing changed).
 */
import type { NextRequest } from 'next/server'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { cancelBooking } from '@/lib/bookings/cancel'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const id = request.nextUrl.pathname.split('/').at(-2) ?? ''
    return ok(await cancelBooking(id, session.user))
  })
)
