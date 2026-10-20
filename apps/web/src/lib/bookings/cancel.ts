/**
 * A player cancels their booking — E06-03.
 *
 * The refund follows the venue's policy when the booking was made (C-10;
 * cancellationRefund in @pitchup/shared), by default all of it 12 hours or
 * more before kick-off, 75% from 2 hours, nothing after. A request the venue
 * hasn't accepted yet (C-13) is withdrawn with everything back.
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
 * −5 within 12 hours of kick-off, −10 within 2 hours (C-9), whatever was refunded.
 * Not for an unpaid checkout, and not when an account is being deleted.
 */
import 'server-only'
import {
  cancellationRefund,
  refundPolicyOf,
  lateCancelReason,
  type CancelBookingResult,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { providerFor } from '@/lib/payments'
import { chargedOnline } from './charged'
import { applyTrustEvent } from '@/lib/trust/apply'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'
import { slotText } from '@/lib/notifications/text'
import { getBookingForViewer } from './read'
import { recordStatus } from './status'

export async function cancelBooking(
  bookingId: string,
  viewer: { id: string; role: string },
  now: Date = new Date(),
  options: { refundAll?: boolean; reason?: string } = {}
): Promise<CancelBookingResult> {
  const told: string[] = []
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
          refundPolicy: true,
          player: { select: { name: true } },
          pitch: { select: { name: true, company: { select: { ownerId: true, name: true } } } },
        },
      })
      if (!b || b.playerId !== viewer.id) throw notFound('api.bookingNotFound')
      // The same per-pitch lock as booking and payment confirmation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${b.pitchId}))`
      const current = await tx.booking.findUniqueOrThrow({
        where: { id: b.id },
        select: { status: true },
      })
      const request = current.status === 'AWAITING_APPROVAL'
      if (current.status !== 'PENDING' && current.status !== 'CONFIRMED' && !request) {
        throw new ApiException('VALIDATION_ERROR', 'api.cantCancel', {
          reason: 'NOT_CANCELLABLE',
        })
      }
      if (b.startTime <= now) {
        throw new ApiException('VALIDATION_ERROR', 'api.alreadyStarted', {
          reason: 'NOT_CANCELLABLE',
        })
      }

      const paid = !!b.paidAt && !!b.stripePaymentIntentId
      const total = paid ? chargedOnline(b) : 0
      const refund =
        options.refundAll || request
          ? { percent: 100, amount: total }
          : cancellationRefund(total, b.startTime, now, refundPolicyOf(b.refundPolicy))
      const provider = providerFor(b.paymentProvider)
      let refundId: string | null = null

      if (paid && refund.amount > 0) {
        if (!provider) {
          throw new ApiException('SERVICE_UNAVAILABLE', 'api.refundsDown')
        }
        try {
          refundId = (await provider.refund(b.stripePaymentIntentId!, refund.amount)).refundId
        } catch (caught) {
          console.error(
            `[bookings] Refund for ${b.id} failed:`,
            caught instanceof Error ? caught.message : 'unknown error'
          )
          throw new ApiException('SERVICE_UNAVAILABLE', 'api.refundFailedBooking')
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
          cancellationReason:
            options.reason ?? (request ? 'Withdrawn by the player' : 'Cancelled by the player'),
          approvalDeadline: null,
          ...(paid ? { refundAmount: refund.amount } : {}),
          ...(refundId ? { stripeRefundId: refundId } : {}),
        },
      })
      await recordStatus(tx, b.id, 'CANCELLED')
      const late = lateCancelReason((b.startTime.getTime() - now.getTime()) / 3_600_000)
      if (late && current.status === 'CONFIRMED' && !options.refundAll) {
        await applyTrustEvent(tx, b.playerId, late, b.id, now)
      }
      // E13-05: both sides hear about a real booking being cancelled; not an
      // unpaid checkout, nor the cancellations of an account being deleted.
      if ((current.status === 'CONFIRMED' || request) && !options.refundAll) {
        await notify(tx, {
          userId: b.playerId,
          type: 'BOOKING_CANCELLED_PLAYER',
          title: t =>
            t(request ? 'notify.playerCancelled.withdrawnTitle' : 'notify.playerCancelled.title'),
          body: (t, locale) =>
            t('notify.playerCancelled.body', {
              pitch: b.pitch.name,
              slot: slotText(b.startTime, locale),
              refund:
                paid && refund.amount > 0
                  ? t('notify.refundedToCard', { amount: refund.amount })
                  : t('notify.playerCancelled.noRefund'),
            }),
          data: { bookingId: b.id },
        })
        await notify(tx, {
          userId: b.pitch.company.ownerId,
          type: 'BOOKING_CANCELLED_PLAYER',
          title: t =>
            t(
              request
                ? 'notify.playerCancelledVenue.withdrawnTitle'
                : 'notify.playerCancelledVenue.title'
            ),
          body: (t, locale) =>
            t(
              request
                ? 'notify.playerCancelledVenue.withdrawnBody'
                : 'notify.playerCancelledVenue.body',
              { player: b.player.name, pitch: b.pitch.name, slot: slotText(b.startTime, locale) }
            ),
          data: { bookingId: b.id, link: `/manager/bookings/${b.id}` },
        })
        told.push(b.playerId, b.pitch.company.ownerId)
      }
      return { refundAmount: paid ? refund.amount : 0, refundPercent: paid ? refund.percent : 0 }
    },
    // A Stripe refund happens inside the transaction.
    { timeout: 20_000 }
  )

  deliverSoon(told)
  return { ...result, booking: await getBookingForViewer(bookingId, viewer) }
}
