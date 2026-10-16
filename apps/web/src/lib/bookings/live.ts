/**
 * Which bookings occupy a pitch — E05.
 *
 * A CONFIRMED booking always does, and so does one waiting for the venue to
 * accept it (AWAITING_APPROVAL, C-13). A PENDING one (created, not yet paid) does
 * only for BOOKING.PENDING_HOLD_MINUTES: long enough to finish paying, short
 * enough that an abandoned checkout does not block the slot for everyone
 * else. Availability, Discover's "Available now" and booking creation all use
 * this one definition.
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import { BOOKING } from '@pitchup/shared'

export const holdExpiresAt = (createdAt: Date): Date =>
  new Date(createdAt.getTime() + BOOKING.PENDING_HOLD_MINUTES * 60_000)

export function liveBookingWhere(now: Date = new Date()): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: { in: ['CONFIRMED', 'AWAITING_APPROVAL'] } },
      {
        status: 'PENDING',
        createdAt: { gt: new Date(now.getTime() - BOOKING.PENDING_HOLD_MINUTES * 60_000) },
      },
    ],
  }
}
