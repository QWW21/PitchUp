/**
 * The manager's view of their company's reviews — E07-05 (API) and E07-09
 * (page). Filter by pitch, sort newest / lowest / unanswered, search by
 * player name. Managers see reviews the way the public does: an anonymous
 * review stays anonymous, and never matches a name search.
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import { REVIEW, type ManagerReviewPage, type ManagerReviewQuery } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/api/errors'
import { REVIEW_ORDER, reviewerName } from '@/lib/venues/reviews'
import { photoList } from './shape'

const HOUR = 3_600_000

/** The company this user manages, or null. */
export const managedCompany = (ownerId: string) =>
  prisma.company.findUnique({
    where: { ownerId },
    select: {
      id: true,
      name: true,
      pitches: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
  })

export async function listCompanyReviews(
  companyId: string,
  viewer: { id: string; role: string },
  q: ManagerReviewQuery,
  now: Date = new Date()
): Promise<ManagerReviewPage> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  })
  // Another company's reviews: as if it did not exist.
  if (!company || (company.ownerId !== viewer.id && viewer.role !== 'ADMIN')) {
    throw notFound('Company not found')
  }

  const where: Prisma.ReviewWhereInput = {
    deletedAt: null,
    moderationStatus: 'APPROVED',
    pitch: { companyId, ...(q.pitchId ? { id: q.pitchId } : {}) },
    ...(q.q
      ? { isAnonymous: false, player: { name: { contains: q.q, mode: 'insensitive' } } }
      : {}),
  }

  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: REVIEW_ORDER[q.sort],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: {
        player: { select: { name: true, deletedAt: true } },
        pitch: { select: { id: true, name: true } },
        _count: { select: { reports: true } },
        reports: { where: { reporterId: viewer.id }, select: { id: true } },
      },
    }),
    prisma.review.count({ where }),
  ])

  return {
    items: rows.map(r => {
      const replyDeadline = r.managerRepliedAt
        ? new Date(r.managerRepliedAt.getTime() + REVIEW.REPLY_EDIT_WINDOW_HOURS * HOUR)
        : null
      return {
        id: r.id,
        rating: r.rating,
        text: r.text,
        playerName: reviewerName(r.player, r.isAnonymous),
        photoUrls: photoList(r.photoUrls),
        pitch: r.pitch,
        reply:
          r.managerReply && r.managerRepliedAt && replyDeadline
            ? {
                text: r.managerReply,
                createdAt: r.managerRepliedAt.toISOString(),
                editableUntil: replyDeadline.toISOString(),
                isEditable: now < replyDeadline,
              }
            : null,
        reportCount: r._count.reports,
        reportedByMe: r.reports.length > 0,
        createdAt: r.createdAt.toISOString(),
      }
    }),
    page: q.page,
    limit: q.limit,
    total,
    hasMore: q.page * q.limit < total,
  }
}
