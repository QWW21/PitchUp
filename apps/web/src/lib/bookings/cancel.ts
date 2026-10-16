/**
 * A player cancels their booking — E06-03.
 *
 * The refund follows PRD §9.2 (cancellationRefund in @pitchup/shared): all
 * of it 24 hours or more before kick-off, half from 2 hours, nothing after.
 * The player paid only the pitch price (E05), so that whole amount is
 * refundable; there is no platform fee to keep back. A player paying at the
 * venue paid only the deposit online (C-8): the same tiers apply to it.
 *
 * The refund is made first, inside the booking's lock: if the payment
 * provider refuses, nothing is cancelled and the player can try again.
 *
 * Deleting an account (E08-03) cancels the player's upcoming bookings with
 * `refundAll`: everything back, whatever the notice.
 *
 * Cancelling a confirmed booking late also costs trust (E12-03, PRD §9.1):
 * −5 within 24 hours of kick-off, −10 within 2 hours, whatever was refunded.
 * Not for an unpaid checkout, and not when an account is being deleted.
 */
import 'server-only'
import { cancellationRefund, lateCancelReason, type CancelBookingResult } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { providerFor } from '@/lib/payments'
import { chargedOnline } from './charged'
import { applyTrustEvent } from '@/lib/trust/apply'
import { getBookingForViewer } from './read'
import { recordStatus } from './status'

export async function cancelBooking(
  bookingId: string,
  viewer: { id: string; role: string },
  now: Date = new Date(),
  options: { refundAll?: boolean; reason?: string } = {}
): Promise<CancelBookingResult> {
  const result = await prisma.$transaction(
    async tx => {
      const b = await tx.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          pitchId: true,
          playerId: true,
          status: true,
          startTime: true,
          totalAmount: true,
          paymentMethod: true,
          depositAmount: true,
          paidAt: true,
          paymentProvider: true,
          stripePaymentIntentId: true,
        },
      })
      if (!b || b.playerId !== viewer.id) throw notFound('Booking not found')
      // The same per-pitch lock as booking and payment confirmation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${b.pitchId}))`
      const current = await tx.booking.findUniqueOrThrow({
        where: { id: b.id },
        select: { status: true },
      })
      if (current.status !== 'PENDING' && current.status !== 'CONFIRMED') {
        throw new ApiException('VALIDATION_ERROR', 'This booking can no longer be cancelled', {
          reason: 'NOT_CANCELLABLE',
        })
      }
      if (b.startTime <= now) {
        throw new ApiException('VALIDATION_ERROR', 'This booking has already started', {
          reason: 'NOT_CANCELLABLE',
        })
      }

      const paid = !!b.paidAt && !!b.stripePaymentIntentId
      const total = paid ? chargedOnline(b) : 0
      const refund = options.refundAll
        ? { percent: 100, amount: total }
        : cancellationRefund(total, b.startTime, now)
      const provider = providerFor(b.paymentProvider)
      let refundId: string | null = null

      if (paid && refund.amount > 0) {
        if (!provider) {
          throw new ApiException('SERVICE_UNAVAILABLE', 'Refunds are unavailable right now')
        }
        try {
          refundId = (await provider.refund(b.stripePaymentIntentId!, refund.amount)).refundId
        } catch (caught) {
          console.error(
            `[bookings] Refund for ${b.id} failed:`,
            caught instanceof Error ? caught.message : 'unknown error'
          )
          throw new ApiException(
            'SERVICE_UNAVAILABLE',
            'The refund could not be made right now. Your booking is unchanged; please try again.'
          )
        }
      } else if (!paid && b.stripePaymentIntentId) {
        // An unpaid checkout: make sure it can no longer be paid.
        await provider?.cancelPayment(b.stripePaymentIntentId)
      }

      await tx.booking.update({
        where: { id: b.id },
        data: {
          status: 'CANCELLED',
          cancelledBy: 'PLAYER',
          cancelledAt: now,
          cancellationReason: options.reason ?? 'Cancelled by the player',
          ...(paid ? { refundAmount: refund.amount } : {}),
          ...(refundId ? { stripeRefundId: refundId } : {}),
        },
      })
      await recordStatus(tx, b.id, 'CANCELLED')
      const late = lateCancelReason((b.startTime.getTime() - now.getTime()) / 3_600_000)
      if (late && current.status === 'CONFIRMED' && !options.refundAll) {
        await applyTrustEvent(tx, b.playerId, late, b.id, now)
      }
      return { refundAmount: paid ? refund.amount : 0, refundPercent: paid ? refund.percent : 0 }
    },
    // A Stripe refund happens inside the transaction.
    { timeout: 20_000 }
  )

  return { ...result, booking: await getBookingForViewer(bookingId, viewer) }
}
