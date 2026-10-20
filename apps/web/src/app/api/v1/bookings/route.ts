/**
 * POST /api/v1/bookings — E05-07. Creates a PENDING booking and starts its
 * payment. Players only (managers too: PRD §6.4 gives them player rights).
 *
 * Body: CreateBookingSchema — venue-local date and HH:MM times.
 * 201 { bookingId, reference, total, holdExpiresAt, payment }
 * 400 validation · 403 inactive pitch / trust tier · 404 pitch
 * 409 SLOT_CONFLICT / SHIRTS_UNAVAILABLE · 429 · 503 payments down
 */
import type { NextRequest } from 'next/server'
import { BOOKING, BookingListQuerySchema, CreateBookingSchema } from '@pitchup/shared'
import { created, err, ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth, requireRole } from '@/lib/api/middleware'
import { validateBody, validateQuery } from '@/lib/api/validate'
import { listBookings } from '@/lib/bookings/mine'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { createBooking } from '@/lib/bookings/create'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireRole('PLAYER')(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, CreateBookingSchema)
    if (parsed.error) return parsed.error

    // Per account, after validation: a typo does not spend an attempt (#153).
    const rate = checkRateLimit(`booking:${session.user.id}`, {
      limit: BOOKING.CREATE_RATE_LIMIT,
      windowMs: BOOKING.CREATE_RATE_WINDOW_MINUTES * 60_000,
    })
    if (!rate.allowed) {
      return err('RATE_LIMITED', 'api.tooManyBookings', 429, {
        retryAfterSeconds: rate.retryAfterSeconds,
      })
    }

    return created(await createBooking(session.user.id, parsed.data))
  })
)

/**
 * GET /api/v1/bookings?tab=upcoming|past|cancelled&cursor=&limit= — E06-01.
 * The player's own bookings, one tab at a time.
 */
export const GET = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const query = validateQuery(request, BookingListQuerySchema)
    if (query.error) return query.error
    const response = ok(await listBookings(session.user.id, query.data))
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  })
)
