/**
 * Booking notices — E13-05, C-11, C-13.
 *
 * Once a booking is paid (or made, when nothing is due online), the player
 * hears it is confirmed (with the confirmation email, which the dispatcher
 * renders for this type) or that it waits for the venue; the venue hears of
 * every new booking, and is asked to answer the ones that wait for it.
 */
import 'server-only'
import { prisma } from '@/lib/prisma'
import { deliverSoon, notify } from './dispatch'
import { slotText } from './text'

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
  const managerLink = `/manager/bookings/${bookingId}`
  const about = (locale: Parameters<typeof slotText>[1]) => ({
    pitch: b.pitch.name,
    company: b.pitch.company.name,
    player: b.player.name,
    slot: slotText(b.startTime, locale),
  })
  if (b.status === 'CONFIRMED') {
    await notify(prisma, {
      userId: b.playerId,
      type: 'BOOKING_CONFIRMED',
      title: t => t('notify.bookingConfirmed.title'),
      body: (t, locale) => t('notify.bookingConfirmed.body', about(locale)),
      data: { bookingId },
    })
    await notify(prisma, {
      userId: b.pitch.company.ownerId,
      type: 'BOOKING_RECEIVED',
      title: t => t('notify.bookingReceived.title'),
      body: (t, locale) => t('notify.bookingReceived.body', about(locale)),
      data: { bookingId, link: managerLink },
    })
  } else {
    await notify(prisma, {
      userId: b.playerId,
      type: 'BOOKING_AWAITING_APPROVAL',
      title: t => t('notify.awaitingApproval.title'),
      body: (t, locale) => t('notify.awaitingApproval.body', about(locale)),
      data: { bookingId },
    })
    await notify(prisma, {
      userId: b.pitch.company.ownerId,
      type: 'BOOKING_REQUESTED',
      title: t => t('notify.bookingRequested.title'),
      body: (t, locale) => t('notify.bookingRequested.body', about(locale)),
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
    title: t => t('notify.bookingConfirmed.title'),
    body: (t, locale) =>
      t('notify.bookingConfirmed.acceptedBody', {
        company: b.pitch.company.name,
        pitch: b.pitch.name,
        slot: slotText(b.startTime, locale),
      }),
    data: { bookingId },
  })
  deliverSoon([b.playerId])
}
