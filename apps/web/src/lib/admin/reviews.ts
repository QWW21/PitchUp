/**
 * Review moderation — E15-04. Reviews with their report counts, most
 * reported first; an admin deletes one for good (the reports with it), and
 * the author is told why. Ratings are worked out from the reviews each time
 * they are read, so nothing needs recalculating.
 */
import 'server-only'
import type { AdminReviewPage, AdminReviewQuery } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/api/errors'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'

export async function listReviews(query: AdminReviewQuery): Promise<AdminReviewPage> {
  const where = {
    deletedAt: null,
    ...(query.rating ? { rating: query.rating } : {}),
    ...(query.search
      ? {
          OR: [
            { text: { contains: query.search, mode: 'insensitive' as const } },
            { pitch: { name: { contains: query.search, mode: 'insensitive' as const } } },
            {
              pitch: {
                company: { name: { contains: query.search, mode: 'insensitive' as const } },
              },
            },
          ],
        }
      : {}),
  }
  // Report counts first, then the page: "most reported" can't be a cursor
  // over a plain column, so the page is an offset into that order.
  const reviews = await prisma.review.findMany({
    where,
    select: { id: true, createdAt: true, _count: { select: { reports: true } } },
  })
  const ordered = reviews
    .filter(r => r._count.reports >= query.minReports)
    .sort(
      (a, b) =>
        b._count.reports - a._count.reports ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id)
    )
  const start = query.cursor ? ordered.findIndex(r => r.id === query.cursor) + 1 : 0
  const slice = ordered.slice(start, start + query.limit)
  const rows = await prisma.review.findMany({
    where: { id: { in: slice.map(r => r.id) } },
    select: {
      id: true,
      rating: true,
      text: true,
      createdAt: true,
      flagReason: true,
      managerReply: true,
      pitch: { select: { id: true, name: true, company: { select: { name: true } } } },
      player: { select: { id: true, name: true } },
      _count: { select: { reports: true } },
    },
  })
  const byId = new Map(rows.map(r => [r.id, r]))
  return {
    items: slice.map(({ id }) => {
      const r = byId.get(id)!
      return {
        id: r.id,
        rating: r.rating,
        text: r.text,
        createdAt: r.createdAt.toISOString(),
        pitch: { id: r.pitch.id, name: r.pitch.name, venue: r.pitch.company.name },
        player: r.player,
        reports: r._count.reports,
        flagReason: r.flagReason,
        managerReply: r.managerReply,
      }
    }),
    nextCursor: start + query.limit < ordered.length ? slice.at(-1)!.id : null,
  }
}

/** Deleted for good, with its reports; the author reads the reason. */
export async function deleteReview(reviewId: string, reason: string): Promise<void> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, playerId: true, deletedAt: true, pitch: { select: { name: true } } },
  })
  if (!review || review.deletedAt) throw notFound('api.reviewNotFound')
  await prisma.$transaction(async tx => {
    await tx.review.delete({ where: { id: review.id } })
    await notify(tx, {
      userId: review.playerId,
      type: 'ADMIN_NOTICE',
      title: t => t('notify.reviewRemoved.title'),
      body: t => t('notify.reviewRemoved.body', { pitch: review.pitch.name, reason }),
      data: { link: '/my-reviews' },
    })
  })
  deliverSoon([review.playerId])
}
