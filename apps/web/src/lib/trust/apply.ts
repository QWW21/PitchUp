/**
 * The trust score engine — E12-01. Every change to a player's score goes
 * through applyTrustEvent, inside the caller's transaction, so the score and
 * its history row are written together or not at all.
 *
 * - The score moves in one SQL statement, clamped to 0–100, so two events at
 *   once can't both read the same starting score and lose a delta.
 * - The history row records the delta as defined (PRD §9.1) even when the
 *   clamp moved the score less; replaying the events with the same clamp
 *   (replayTrustScore) gives the same score back.
 * - Completed bookings earn at most +10 a calendar month (venue time); past
 *   the cap no event is written, so the history and the score still agree.
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import {
  TRUST_SCORE_DELTAS,
  TRUST_SCORE_MAX,
  TRUST_SCORE_MIN,
  TRUST_SCORE_MONTHLY_COMPLETION_CAP,
  venueClock,
  venueTimeToUtc,
  type TrustScoreReason,
} from '@pitchup/shared'

export interface TrustResult {
  /** False when the monthly cap on completion points stopped it. */
  applied: boolean
  score: number | null
}

/** The first instant of this calendar month, Bucharest time. */
function monthStart(now: Date): Date {
  return venueTimeToUtc(`${venueClock(now).date.slice(0, 8)}01`, 0)
}

export async function applyTrustEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  reason: TrustScoreReason,
  relatedBookingId: string | null = null,
  now: Date = new Date()
): Promise<TrustResult> {
  const delta = TRUST_SCORE_DELTAS[reason]
  // One player's trust changes one at a time, so the monthly cap can't be raced past.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'trust:' + userId}))`

  if (reason === 'BOOKING_COMPLETED') {
    const earned = await tx.trustScoreEvent.aggregate({
      where: { userId, reason: 'BOOKING_COMPLETED', createdAt: { gte: monthStart(now) } },
      _sum: { delta: true },
    })
    if ((earned._sum.delta ?? 0) + delta > TRUST_SCORE_MONTHLY_COMPLETION_CAP) {
      return { applied: false, score: null }
    }
  }

  const rows = await tx.$queryRaw<{ trustScore: number }[]>`
    UPDATE "User"
    SET "trustScore" = LEAST(${TRUST_SCORE_MAX}, GREATEST(${TRUST_SCORE_MIN}, "trustScore" + ${delta}))
    WHERE id = ${userId}
    RETURNING "trustScore"`
  if (!rows.length) return { applied: false, score: null }
  await tx.trustScoreEvent.create({
    data: { userId, delta, reason, relatedBookingId, createdAt: now },
  })
  return { applied: true, score: rows[0]!.trustScore }
}
