/**
 * Rating rules, one place — PRD §11.2.
 *
 * - A pitch's rating is the mean of its approved reviews.
 * - A company's rating is the mean of its pitches' ratings, so one heavily
 *   reviewed pitch does not drown out the rest.
 * - Nothing is shown below REVIEW.MIN_FOR_PUBLIC_RATING reviews.
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import { REVIEW } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'

export const round1 = (n: number) => Math.round(n * 10) / 10

export interface PitchStats {
  mean: number
  count: number
}

/** Mean and count of approved reviews per pitch, in one grouped query. */
export async function pitchStats(pitch: Prisma.PitchWhereInput): Promise<Map<string, PitchStats>> {
  const rows = await prisma.review.groupBy({
    by: ['pitchId'],
    where: { moderationStatus: 'APPROVED', deletedAt: null, pitch },
    _avg: { rating: true },
    _count: { _all: true },
  })
  return new Map(
    rows
      .filter(r => r._avg.rating !== null)
      .map(r => [r.pitchId, { mean: r._avg.rating!, count: r._count._all }])
  )
}

/** A rating the public may see, or null while there are too few reviews. */
export function publicRating(mean: number | null, count: number): number | null {
  return mean !== null && count >= REVIEW.MIN_FOR_PUBLIC_RATING ? round1(mean) : null
}

/** Company rating from its pitches' stats. */
export function companyRating(stats: PitchStats[]): {
  avgRating: number | null
  reviewCount: number
} {
  const reviewCount = stats.reduce((sum, s) => sum + s.count, 0)
  const mean = stats.length ? stats.reduce((sum, s) => sum + s.mean, 0) / stats.length : null
  return { avgRating: publicRating(mean, reviewCount), reviewCount }
}
