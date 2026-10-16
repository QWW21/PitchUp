/**
 * The monthly trust job — E12-05, run on the 1st (vercel.json).
 *
 * 1. Recovery: +1 for every player below 100 with no negative event in the
 *    month that just ended (PRD §9.1), at most once a month.
 * 2. Recalculation: every score is rebuilt from its history
 *    (replayTrustScore) and corrected if it drifted, e.g. after a manual
 *    database edit or a write that half failed. One player's failure doesn't
 *    stop the rest.
 */
import 'server-only'
import {
  TRUST_SCORE_MAX,
  addDays,
  replayTrustScore,
  venueClock,
  venueTimeToUtc,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { applyTrustEvent } from './apply'

export interface MonthlyResult {
  players: number
  recovered: number
  corrected: number
  failed: number
}

export async function runMonthlyTrust(now: Date = new Date()): Promise<MonthlyResult> {
  const today = venueClock(now).date
  const thisMonth = venueTimeToUtc(`${today.slice(0, 8)}01`, 0)
  const lastMonthDay = addDays(`${today.slice(0, 8)}01`, -1)
  const lastMonth = venueTimeToUtc(`${lastMonthDay.slice(0, 8)}01`, 0)

  const players = await prisma.user.findMany({
    where: { deletedAt: null, role: { in: ['PLAYER', 'MANAGER'] } },
    select: { id: true, trustScore: true, createdAt: true },
  })
  const result: MonthlyResult = { players: players.length, recovered: 0, corrected: 0, failed: 0 }

  for (const p of players) {
    try {
      await prisma.$transaction(async tx => {
        if (p.trustScore < TRUST_SCORE_MAX && p.createdAt < thisMonth) {
          const [negative, already] = await Promise.all([
            tx.trustScoreEvent.count({
              where: {
                userId: p.id,
                delta: { lt: 0 },
                createdAt: { gte: lastMonth, lt: thisMonth },
              },
            }),
            tx.trustScoreEvent.count({
              where: { userId: p.id, reason: 'MONTHLY_RECOVERY', createdAt: { gte: thisMonth } },
            }),
          ])
          if (!negative && !already) {
            await applyTrustEvent(tx, p.id, 'MONTHLY_RECOVERY', null, now)
            result.recovered++
          }
        }
        const events = await tx.trustScoreEvent.findMany({
          where: { userId: p.id },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { delta: true },
        })
        const expected = replayTrustScore(events.map(e => e.delta))
        const current = await tx.user.findUniqueOrThrow({
          where: { id: p.id },
          select: { trustScore: true },
        })
        if (current.trustScore !== expected) {
          await tx.user.update({ where: { id: p.id }, data: { trustScore: expected } })
          result.corrected++
        }
      })
    } catch (caught) {
      result.failed++
      console.error(
        `[trust-monthly] ${p.id} failed:`,
        caught instanceof Error ? caught.message : 'unknown error'
      )
    }
  }
  return result
}
