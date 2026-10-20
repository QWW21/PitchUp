/**
 * Reporting a review — E07-04, PRD §11.3. Any signed-in user, once per
 * review. The review stays up: it is flagged and the admins are told; what
 * happens next is theirs to decide (E15).
 */
import 'server-only'
import { Prisma } from '@prisma/client'
import type { ReportReviewInput } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'

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
    throw notFound('api.reviewNotFound')
  }
  if (review.playerId === reporterId) {
    throw new ApiException('VALIDATION_ERROR', 'api.reportOwn', {
      reason: 'OWN_REVIEW',
    })
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null },
    select: { id: true },
  })
  try {
    await prisma.$transaction(async tx => {
      await tx.reviewReport.create({
        data: {
          reviewId,
          reporterId,
          category: input.category,
          detail: input.detail ?? null,
        },
      })
      await tx.review.update({
        where: { id: reviewId },
        // The first reason is kept; later reports add to the count.
        data: { isFlagged: true, flagReason: review.flagReason ?? input.category },
      })
      for (const a of admins) {
        await notify(tx, {
          userId: a.id,
          type: 'REVIEW_REPORTED',
          title: t => t('notify.reviewReported.title'),
          body: t =>
            t('notify.reviewReported.body', {
              category: t(`reportCategory.${input.category}`),
            }),
          data: { reviewId, category: input.category, link: '/admin/companies' },
        })
      }
    })
    deliverSoon(admins.map(a => a.id))
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
      throw new ApiException('CONFLICT', 'api.alreadyReported', {
        reason: 'ALREADY_REPORTED',
      })
    }
    throw caught
  }
}
