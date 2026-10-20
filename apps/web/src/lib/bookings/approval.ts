/**
 * The venue's side of a booking — C-11 … C-13.
 *
 * - A paid booking is confirmed at once, or, at a venue that confirms each
 *   booking by hand, waits as AWAITING_APPROVAL (holding the slot) until the
 *   manager accepts or declines it. Unanswered, it is declined at its
 *   deadline (24 hours after paying, or 2 hours before kick-off).
 * - The manager may also cancel a confirmed booking before kick-off.
 *
 * Declining and cancelling refund everything that was paid online, cost the
 * player no trust, and tell the player why.
 */
import 'server-only'
import type { CancelledBy } from '@prisma/client'
import { approvalDeadline, type BookingStatus } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { providerFor } from '@/lib/payments'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'
import { notifyAccepted } from '@/lib/notifications/booking'
import { sentence, slotText } from '@/lib/notifications/text'
import { chargedOnline } from './charged'
import { recordStatus } from './status'

/** What a booking becomes once paid (or once made, when nothing is due online). */
export function paidState(
  autoApprove: boolean,
  paidAt: Date,
  start: Date
): {
  status: Extract<BookingStatus, 'CONFIRMED' | 'AWAITING_APPROVAL'>
  approvalDeadline: Date | null
} {
  return autoApprove
    ? { status: 'CONFIRMED', approvalDeadline: null }
    : { status: 'AWAITING_APPROVAL', approvalDeadline: approvalDeadline(paidAt, start) }
}

const notAllowed = (message: string) =>
  new ApiException('CONFLICT', message, { reason: 'NOT_ALLOWED' })

/** Locks the booking's pitch and reads what deciding on it needs. */
async function lockBooking(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  bookingId: string,
  companyId: string | null
) {
  const found = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { pitchId: true, pitch: { select: { companyId: true } } },
  })
  if (!found || (companyId && found.pitch.companyId !== companyId)) {
    throw notFound('api.bookingNotFound')
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.pitchId}))`
  return tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      playerId: true,
      startTime: true,
      approvalDeadline: true,
      totalAmount: true,
      paymentMethod: true,
      depositAmount: true,
      paidAt: true,
      paymentProvider: true,
      stripePaymentIntentId: true,
      pitch: { select: { name: true, company: { select: { name: true, ownerId: true } } } },
    },
  })
}

/** C-13: the manager accepts a request; the player gets the confirmation. */
export async function acceptBooking(
  companyId: string,
  bookingId: string,
  now: Date = new Date()
): Promise<void> {
  await prisma.$transaction(async tx => {
    const b = await lockBooking(tx, bookingId, companyId)
    if (b.status === 'CONFIRMED') return
    if (b.status !== 'AWAITING_APPROVAL') throw notAllowed('This booking is not waiting for you')
    if (b.approvalDeadline && b.approvalDeadline <= now) {
      throw notAllowed('The time to answer this request has passed')
    }
    await tx.booking.update({
      where: { id: b.id },
      data: { status: 'CONFIRMED', approvalDeadline: null },
    })
    await recordStatus(tx, b.id, 'CONFIRMED')
  })
  await notifyAccepted(bookingId)
}

/**
 * C-12 / C-13: the venue declines a request or cancels a booking, or a
 * request runs out of time (`by: 'SYSTEM'`). Everything paid online comes
 * back; the refund is made first, so if the provider refuses nothing changes.
 */
export async function cancelForVenue(
  bookingId: string,
  options: { by: Extract<CancelledBy, 'MANAGER' | 'SYSTEM'>; reason: string; companyId?: string },
  now: Date = new Date()
): Promise<{ declined: boolean; refundAmount: number }> {
  const told: string[] = []
  const result = await prisma.$transaction(
    async tx => {
      const b = await lockBooking(tx, bookingId, options.companyId ?? null)
      const declined = b.status === 'AWAITING_APPROVAL'
      if (!declined && b.status !== 'CONFIRMED') {
        throw notAllowed('This booking can no longer be cancelled')
      }
      if (!declined && b.startTime <= now) throw notAllowed('This booking has already started')

      const paid = !!b.paidAt && !!b.stripePaymentIntentId
      const amount = paid ? chargedOnline(b) : 0
      let refundId: string | null = null
      if (amount > 0) {
        const provider = providerFor(b.paymentProvider)
        if (!provider) {
          throw new ApiException('SERVICE_UNAVAILABLE', 'api.refundsDown')
        }
        try {
          refundId = (await provider.refund(b.stripePaymentIntentId!, amount)).refundId
        } catch (caught) {
          console.error(
            `[bookings] Venue refund for ${b.id} failed:`,
            caught instanceof Error ? caught.message : 'unknown error'
          )
          throw new ApiException('SERVICE_UNAVAILABLE', 'api.refundFailed')
        }
      }
      await tx.booking.update({
        where: { id: b.id },
        data: {
          status: 'CANCELLED',
          cancelledBy: options.by,
          cancelledAt: now,
          cancellationReason: options.reason,
          approvalDeadline: null,
          ...(paid ? { refundAmount: amount } : {}),
          ...(refundId ? { stripeRefundId: refundId } : {}),
        },
      })
      await recordStatus(tx, b.id, 'CANCELLED')

      const titleKey = declined
        ? options.by === 'SYSTEM'
          ? 'notify.venueCancelled.expiredTitle'
          : 'notify.venueCancelled.declinedTitle'
        : 'notify.venueCancelled.cancelledTitle'
      await notify(tx, {
        userId: b.playerId,
        type: 'BOOKING_CANCELLED_MANAGER',
        title: t => t(titleKey),
        body: (t, locale) =>
          t('notify.venueCancelled.body', {
            pitch: b.pitch.name,
            company: b.pitch.company.name,
            slot: slotText(b.startTime, locale),
            reason: sentence(options.reason),
            money: amount > 0 ? ` ${t('notify.refundedToCard', { amount })}` : '',
          }),
        data: { bookingId: b.id },
      })
      told.push(b.playerId)
      if (options.by === 'SYSTEM') {
        await notify(tx, {
          userId: b.pitch.company.ownerId,
          type: 'BOOKING_CANCELLED_MANAGER',
          title: t => t('notify.requestExpiredVenue.title'),
          body: (t, locale) =>
            t('notify.requestExpiredVenue.body', {
              pitch: b.pitch.name,
              slot: slotText(b.startTime, locale),
            }),
          data: { bookingId: b.id, link: `/manager/bookings/${b.id}` },
        })
        told.push(b.pitch.company.ownerId)
      }
      return { declined, refundAmount: amount }
    },
    // A refund happens inside the transaction.
    { timeout: 20_000 }
  )
  deliverSoon(told)
  return result
}

/** The hourly job: requests nobody answered in time are declined. */
export async function expireRequests(now: Date = new Date()): Promise<number> {
  const due = await prisma.booking.findMany({
    where: { status: 'AWAITING_APPROVAL', approvalDeadline: { lte: now } },
    select: { id: true },
    take: 200,
  })
  let expired = 0
  for (const { id } of due) {
    try {
      await cancelForVenue(id, { by: 'SYSTEM', reason: "The venue didn't answer in time" }, now)
      expired++
    } catch (caught) {
      // One failure (a refund refused) must not stop the rest; the next run retries.
      console.error(
        `[bookings] Expiring request ${id} failed:`,
        caught instanceof Error ? caught.message : 'unknown error'
      )
    }
  }
  return expired
}
