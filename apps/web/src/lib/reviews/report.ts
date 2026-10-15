/**
 * Reporting a review — E07-04, PRD §11.3. Any signed-in user, once per
 * review. The review stays up: it is flagged and the admins are told; what
 * happens next is theirs to decide (E15).
 */
import 'server-only'
import { Prisma } from '@prisma/client'
import { REPORT_CATEGORY_LABELS, type ReportReviewInput } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'

export async function reportReview(
  reviewId: string,
  reporterId: string,
  input: ReportReviewInput
): Promise<void> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { playerId: true, deletedAt: true, moderationStatus: true, flagReason: true },
  })
  // Only what the public can see can be reported.
  if (!review || review.deletedAt || review.moderationStatus !== 'APPROVED') {
    throw notFound('Review not found')
  }
  if (review.playerId === reporterId) {
    throw new ApiException('VALIDATION_ERROR', 'You cannot report your own review', {
      reason: 'OWN_REVIEW',
    })
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null },
    select: { id: true },
  })
  const label = REPORT_CATEGORY_LABELS[input.category]
  try {
    await prisma.$transaction([
      prisma.reviewReport.create({
        data: {
          reviewId,
          reporterId,
          category: input.category,
          detail: input.detail ?? null,
        },
      }),
      prisma.review.update({
        where: { id: reviewId },
        // The first reason is kept; later reports add to the count.
        data: { isFlagged: true, flagReason: review.flagReason ?? input.category },
      }),
      prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          type: 'REVIEW_REPORTED' as const,
          title: 'Review reported',
          body: `A review was reported: ${label}.`,
          data: { reviewId, category: input.category },
        })),
      }),
    ])
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
      throw new ApiException('CONFLICT', 'You have already reported this review', {
        reason: 'ALREADY_REPORTED',
      })
    }
    throw caught
  }
}
