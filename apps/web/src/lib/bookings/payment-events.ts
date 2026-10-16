/**
 * What happens to a booking when its payment resolves — E05-08.
 *
 * Called by the Stripe webhook, by the test-payment endpoint, and when a
 * client checks a booking before the webhook has arrived. Each function is
 * idempotent: Stripe can deliver one event twice, and two of these callers
 * can see the same payment.
 */
import 'server-only'
import { prisma } from '@/lib/prisma'
import { providerFor } from '@/lib/payments'
import { notifyBookingPaid } from '@/lib/notifications/booking'
import { paidState } from './approval'
import { chargedOnline } from './charged'
import { liveBookingWhere } from './live'
import { recordStatus } from './status'

export type PaidOutcome = 'confirmed' | 'already' | 'refunded' | 'unknown'

/**
 * The payment succeeded: confirm the booking. If the booking was meanwhile
 * replaced, or its hold ran out and someone else took the slot, the money is
 * refunded in full instead, because there is nothing to play.
 */
export async function confirmPaid(
  bookingId: string,
  paymentId: string,
  now: Date = new Date()
): Promise<PaidOutcome> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      pitchId: true,
      startTime: true,
      endTime: true,
      status: true,
      totalAmount: true,
      paymentMethod: true,
      depositAmount: true,
      paymentProvider: true,
      stripePaymentIntentId: true,
      stripeRefundId: true,
      pitch: { select: { company: { select: { autoApproveBookings: true } } } },
    },
  })
  if (!booking || booking.stripePaymentIntentId !== paymentId) {
    console.error(`[payments] A payment arrived for an unknown booking: ${bookingId}`)
    return 'unknown'
  }
  if (
    booking.status === 'CONFIRMED' ||
    booking.status === 'AWAITING_APPROVAL' ||
    booking.stripeRefundId
  ) {
    return 'already'
  }

  const outcome = await prisma.$transaction(async tx => {
    // The same per-pitch lock as booking creation: no booking can slip in
    // between the clash check and the confirmation.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.pitchId}))`
    const current = await tx.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { status: true },
    })
    if (current.status === 'CONFIRMED' || current.status === 'AWAITING_APPROVAL') {
      return 'already' as const
    }
    if (current.status === 'PENDING') {
      const clash = await tx.booking.count({
        where: {
          id: { not: booking.id },
          pitchId: booking.pitchId,
          ...liveBookingWhere(now),
          startTime: { lt: booking.endTime },
          endTime: { gt: booking.startTime },
        },
      })
      if (!clash) {
        // C-13: confirmed now, or held for a venue that confirms each booking.
        const next = paidState(booking.pitch.company.autoApproveBookings, now, booking.startTime)
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: next.status, paidAt: now, approvalDeadline: next.approvalDeadline },
        })
        await recordStatus(tx, booking.id, next.status)
        return 'confirmed' as const
      }
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledBy: 'SYSTEM',
          cancelledAt: now,
          cancellationReason: 'The time was taken while the payment was pending',
        },
      })
      await recordStatus(tx, booking.id, 'CANCELLED')
    }
    return 'refund' as const
  })

  if (outcome === 'refund') {
    const provider = providerFor(booking.paymentProvider)
    if (!provider) {
      console.error(`[payments] Booking ${booking.id} needs a refund but its provider is gone`)
      return 'unknown'
    }
    const { refundId } = await provider.refund(paymentId)
    await prisma.booking.update({
      where: { id: booking.id },
      data: { refundAmount: chargedOnline(booking), stripeRefundId: refundId },
    })
    return 'refunded'
  }

  if (outcome === 'confirmed') {
    // Best effort, like the email: the card is shown on the booking detail.
    const card = await providerFor(booking.paymentProvider)
      ?.cardDetails(paymentId)
      .catch(() => null)
    if (card) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { cardBrand: card.brand, cardLast4: card.last4 },
      })
    }
    // Best effort: a mail outage must not undo a paid booking.
    await notifyBookingPaid(booking.id).catch(caught =>
      console.error(
        `[payments] Confirmation notice for ${booking.id} failed:`,
        caught instanceof Error ? caught.message : 'unknown error'
      )
    )
  }
  return outcome
}

/** The payment failed: the booking is cancelled and the slot is free again. */
export async function markPaymentFailed(bookingId: string, message: string): Promise<boolean> {
  return prisma.$transaction(async tx => {
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: 'PENDING' },
      data: {
        status: 'CANCELLED',
        cancelledBy: 'SYSTEM',
        cancelledAt: new Date(),
        cancellationReason: `Payment failed: ${message}`.slice(0, 300),
      },
    })
    if (count) await recordStatus(tx, bookingId, 'CANCELLED')
    return count > 0
  })
}

/** A refund made on the provider's side (dashboard, or a cancellation in E06). */
export async function recordRefund(
  paymentId: string,
  amountRon: number,
  refundId: string | null
): Promise<void> {
  await prisma.booking.updateMany({
    where: { stripePaymentIntentId: paymentId },
    data: { refundAmount: amountRon, ...(refundId ? { stripeRefundId: refundId } : {}) },
  })
}
