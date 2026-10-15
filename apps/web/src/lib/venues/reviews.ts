/**
 * Public reviews — E04-02 (preview), E04-07 (full list), E07-01 (sorting,
 * replies).
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import {
  playerDisplayName,
  type ReviewItem,
  type ReviewPage,
  type ReviewSort,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { companyRating, pitchStats, publicRating } from './ratings'

export const reviewInclude = {
  player: { select: { name: true, profilePhotoUrl: true } },
  pitch: { select: { name: true } },
} satisfies Prisma.ReviewInclude

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>

/** An anonymous review exposes neither name nor photo. */
export function toReviewItem(r: ReviewRow): ReviewItem {
  const photoUrls = Array.isArray(r.photoUrls)
    ? r.photoUrls.filter((u): u is string => typeof u === 'string')
    : []
  return {
    id: r.id,
    pitchId: r.pitchId,
    pitchName: r.pitch.name,
    rating: r.rating,
    text: r.text?.trim() || null,
    isAnonymous: r.isAnonymous,
    playerName: playerDisplayName(r.player.name, r.isAnonymous),
    playerAvatarUrl: r.isAnonymous ? null : r.player.profilePhotoUrl,
    photoUrls,
    managerReply: r.managerReply,
    managerRepliedAt: r.managerRepliedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }
}

export interface ReviewQuery {
  pitchId?: string | undefined
  companyId?: string | undefined
  sort?: ReviewSort | undefined
  page: number
  limit: number
}

/** The id last, so equal ratings or dates still page in a fixed order. */
export const REVIEW_ORDER: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  highest: [{ rating: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  lowest: [{ rating: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
  // No reply first (nulls first), then the rest by latest reply.
  unanswered: [
    { managerRepliedAt: { sort: 'desc', nulls: 'first' } },
    { createdAt: 'desc' },
    { id: 'desc' },
  ],
}

/**
 * One page of approved reviews for a pitch or a company, in the order asked (newest first by default), with
 * the star distribution and rating that head the list. Returns null when the
 * pitch or company is not publicly visible.
 */
export async function listReviews(q: ReviewQuery): Promise<ReviewPage | null> {
  // Only reviews on venues the public can see.
  const pitchWhere: Prisma.PitchWhereInput = {
    company: { status: 'ACTIVE' },
    ...(q.pitchId ? { id: q.pitchId } : {}),
    ...(q.companyId ? { companyId: q.companyId } : {}),
  }
  const visible = await prisma.pitch.count({ where: pitchWhere })
  if (!visible) return null

  const where: Prisma.ReviewWhereInput = {
    moderationStatus: 'APPROVED',
    deletedAt: null,
    pitch: pitchWhere,
  }

  const [rows, total, byStar, stats] = await Promise.all([
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: REVIEW_ORDER[q.sort ?? 'newest'],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
    pitchStats(pitchWhere),
  ])

  const distribution: ReviewPage['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const row of byStar) {
    if (row.rating >= 1 && row.rating <= 5) distribution[row.rating as 1] = row._count._all
  }

  // A single pitch is rated on its own reviews; a company on its pitches' means.
  const avgRating = q.pitchId
    ? publicRating(stats.get(q.pitchId)?.mean ?? null, total)
    : companyRating([...stats.values()]).avgRating

  return {
    reviews: rows.map(toReviewItem),
    page: q.page,
    limit: q.limit,
    total,
    hasMore: q.page * q.limit < total,
    avgRating,
    distribution,
  }
}
