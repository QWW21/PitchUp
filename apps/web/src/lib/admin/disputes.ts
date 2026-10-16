/**
 * No-show disputes — E12-04. A player disputes a no-show (E06-04); an admin
 * decides.
 *
 * - The player was right: +10 trust (DISPUTE_WON, which offsets most of the
 *   −20), the booking counts as played, and a "deposit back" deposit the
 *   venue kept is refunded, as confirming attendance would have done.
 * - The venue was right: the no-show stands. No second penalty for having
 *   disputed, or players would stop disputing genuine mistakes.
 *
 * Managers have no trust score (PRD §9.1), so a wrong report doesn't cost
 * the venue points; the ticket leaves a manager-reliability measure open.
 */
import 'server-only'
import {
  bookingReference,
  endLabel,
  fromMinutes,
  venueClock,
  type OpenDispute,
  type ResolveDisputeInput,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, conflict, notFound } from '@/lib/api/errors'
import { providerFor } from '@/lib/payments'
import { recordStatus } from '@/lib/bookings/status'
import { applyTrustEvent } from '@/lib/trust/apply'

export async function listOpenDisputes(): Promise<OpenDispute[]> {
  const rows = await prisma.noShow.findMany({
    where: { disputeStatus: 'OPEN' },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      booking: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          player: { select: { name: true, email: true } },
          pitch: { select: { name: true, company: { select: { name: true } } } },
        },
      },
    },
  })
  return rows.map(r => {
    const s = venueClock(r.booking.startTime)
    const e = venueClock(r.booking.endTime)
    return {
      bookingId: r.booking.id,
      reference: bookingReference(r.booking.id),
      date: s.date,
      startTime: fromMinutes(s.minutes),
      endTime: endLabel(e.date === s.date ? e.minutes : 24 * 60),
      pitch: r.booking.pitch.name,
      venue: r.booking.pitch.company.name,
      player: r.booking.player,
      managerReason: r.reason,
      disputeText: r.disputeText,
      reportedAt: r.createdAt.toISOString(),
      keptAmount: Number(r.penaltyAmount),
    }
  })
}

export async function resolveDispute(
  adminId: string,
  bookingId: string,
  input: ResolveDisputeInput,
  now: Date = new Date()
): Promise<{ outcome: ResolveDisputeInput['outcome'] }> {
  await prisma.$transaction(
    async tx => {
      const found = await tx.noShow.findUnique({
        where: { bookingId },
        select: { booking: { select: { pitchId: true } } },
      })
      if (!found) throw notFound('Dispute not found')
      // The same per-pitch lock as the booking's other changes: decided once.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.booking.pitchId}))`
      const ns = await tx.noShow.findUniqueOrThrow({
        where: { bookingId },
        include: {
          booking: {
            select: {
              id: true,
              playerId: true,
              paymentMethod: true,
              depositAmount: true,
              paidAt: true,
              paymentProvider: true,
              stripePaymentIntentId: true,
              stripeRefundId: true,
              pitch: { select: { name: true, company: { select: { ownerId: true } } } },
            },
          },
        },
      })
      if (ns.disputeStatus !== 'OPEN') {
        throw conflict('This dispute has already been decided', { reason: 'ALREADY_RESOLVED' })
      }
      const b = ns.booking
      await tx.noShow.update({
        where: { bookingId },
        data: {
          disputeStatus: input.outcome,
          resolution: input.note,
          resolvedByAdminId: adminId,
          resolvedAt: now,
        },
      })

      const playerWon = input.outcome === 'RESOLVED_PLAYER'
      if (playerWon) {
        await applyTrustEvent(tx, b.playerId, 'DISPUTE_WON', b.id, now)
        await tx.booking.update({
          where: { id: b.id },
          data: { status: 'COMPLETED', attendedAt: now },
        })
        await recordStatus(tx, b.id, 'COMPLETED')
        const deposit = Number(b.depositAmount ?? 0)
        if (
          b.paymentMethod === 'VENUE_REFUND_DEPOSIT' &&
          deposit > 0 &&
          b.paidAt &&
          b.stripePaymentIntentId &&
          !b.stripeRefundId
        ) {
          const provider = providerFor(b.paymentProvider)
          if (!provider) {
            throw new ApiException('SERVICE_UNAVAILABLE', 'Refunds are unavailable right now')
          }
          const { refundId } = await provider.refund(b.stripePaymentIntentId, deposit)
          await tx.booking.update({
            where: { id: b.id },
            data: { refundAmount: deposit, stripeRefundId: refundId },
          })
        }
      }

      await tx.notification.createMany({
        data: [
          {
            userId: b.playerId,
            type: 'DISPUTE_RESOLVED',
            title: playerWon ? 'Your dispute was upheld' : 'Your dispute was not upheld',
            body: playerWon
              ? `The no-show at ${b.pitch.name} is removed and your trust score is restored. ${input.note}`
              : `The no-show at ${b.pitch.name} stands. ${input.note}`,
            data: { bookingId: b.id },
          },
          {
            userId: b.pitch.company.ownerId,
            type: 'DISPUTE_RESOLVED',
            title: playerWon ? 'A no-show was overturned' : 'A no-show was confirmed',
            body: `${b.pitch.name}: ${input.note}`,
            data: { bookingId: b.id },
          },
        ],
      })
    },
    // A Stripe refund may happen inside the transaction.
    { timeout: 20_000 }
  )
  return { outcome: input.outcome }
}
