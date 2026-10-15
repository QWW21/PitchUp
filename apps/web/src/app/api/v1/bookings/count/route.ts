/**
 * GET /api/v1/bookings/count — E06-04. Upcoming bookings and completed ones
 * still waiting for a review, for a badge.
 */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { countBookings } from '@/lib/bookings/mine'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (_request, session) => ok(await countBookings(session.user.id)))
)
