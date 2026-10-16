/**
 * Booking notices — E13-05: confirmed (with the confirmation email, which
 * the dispatcher renders for this type) and cancelled.
 */
import 'server-only'
import { formatDateLong, fromMinutes, venueClock } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { deliverSoon, notify } from './dispatch'

const when = (start: Date) => {
  const c = venueClock(start)
  return `${formatDateLong(c.date)} at ${fromMinutes(c.minutes)}`
}

/** After a payment succeeds, or a no-deposit booking is made. */
export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      playerId: true,
      startTime: true,
      pitch: { select: { name: true, company: { select: { name: true } } } },
    },
  })
  if (!b) return
  await notify(prisma, {
    userId: b.playerId,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking confirmed',
    body: `${b.pitch.name} at ${b.pitch.company.name}, ${when(b.startTime)}.`,
    data: { bookingId },
  })
  deliverSoon([b.playerId])
}
