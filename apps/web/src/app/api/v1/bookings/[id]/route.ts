/**
 * GET /api/v1/bookings/:id — the booking for its player (E05 confirmation
 * step; E06-02 extends it). A PENDING booking is checked with the payment
 * provider first, so the answer is current even before the webhook lands.
 */
import type { NextRequest } from 'next/server'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { getBookingForViewer } from '@/lib/bookings/read'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const id = request.nextUrl.pathname.split('/').pop() ?? ''
    const booking = await getBookingForViewer(id, {
      id: session.user.id,
      role: session.user.role,
    })
    const response = ok(booking)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  })
)
