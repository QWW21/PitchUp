/**
 * Booking notices — E13-05, C-11, C-13.
 *
 * Once a booking is paid (or made, when nothing is due online), the player
 * hears it is confirmed (with the confirmation email, which the dispatcher
 * renders for this type) or that it waits for the venue; the venue hears of
 * every new booking, and is asked to answer the ones that wait for it.
 */
import 'server-only'
import { formatDateLong, fromMinutes, venueClock } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { deliverSoon, notify } from './dispatch'

const when = (start: Date) => {
  const c = venueClock(start)
  return `${formatDateLong(c.date)} at ${fromMinutes(c.minutes)}`
}

const load = (bookingId: string) =>
  prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      playerId: true,
      startTime: true,
      player: { select: { name: true } },
      pitch: { select: { name: true, company: { select: { name: true, ownerId: true } } } },
    },
  })

/** After a payment succeeds, or a booking with nothing to pay online is made. */
export async function notifyBookingPaid(bookingId: string): Promise<void> {
  const b = await load(bookingId)
  if (!b || (b.status !== 'CONFIRMED' && b.status !== 'AWAITING_APPROVAL')) return
  const slot = `${b.pitch.name}, ${when(b.startTime)}`
  const managerLink = `/manager/bookings/${bookingId}`
  if (b.status === 'CONFIRMED') {
    await notify(prisma, {
      userId: b.playerId,
      type: 'BOOKING_CONFIRMED',
      title: 'Booking confirmed',
      body: `${b.pitch.name} at ${b.pitch.company.name}, ${when(b.startTime)}.`,
      data: { bookingId },
    })
    await notify(prisma, {
      userId: b.pitch.company.ownerId,
      type: 'BOOKING_RECEIVED',
      title: 'New booking',
      body: `${b.player.name} booked ${slot}.`,
      data: { bookingId, link: managerLink },
    })
  } else {
    await notify(prisma, {
      userId: b.playerId,
      type: 'BOOKING_AWAITING_APPROVAL',
      title: 'Booking sent to the venue',
      body: `${b.pitch.company.name} confirms each booking. You'll hear about ${slot} soon; if they decline, you get all your money back.`,
      data: { bookingId },
    })
    await notify(prisma, {
      userId: b.pitch.company.ownerId,
      type: 'BOOKING_REQUESTED',
      title: 'A booking waits for your answer',
      body: `${b.player.name} wants ${slot}. Accept or decline it.`,
      data: { bookingId, link: managerLink },
    })
  }
  deliverSoon([b.playerId, b.pitch.company.ownerId])
}

/** C-13: the venue accepted a request. */
export async function notifyAccepted(bookingId: string): Promise<void> {
  const b = await load(bookingId)
  if (!b) return
  await notify(prisma, {
    userId: b.playerId,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking confirmed',
    body: `${b.pitch.company.name} accepted your booking: ${b.pitch.name}, ${when(b.startTime)}.`,
    data: { bookingId },
  })
  deliverSoon([b.playerId])
}
