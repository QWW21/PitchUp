/**
 * The venue's reply to a review — E07-03, PRD §8.5. One reply per review,
 * written by the manager who owns the pitch's company, editable for
 * REVIEW.REPLY_EDIT_WINDOW_HOURS and removable at any time.
 *
 * The reply lives on the review row (`managerReply`, `managerRepliedAt`),
 * which is what makes "one per review" automatic.
 */
import 'server-only'
import { REVIEW } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'

const HOUR = 3_600_000

/** The review, if this manager's company owns its pitch. Anyone else: 404. */
async function ownedReview(reviewId: string, managerId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      playerId: true,
      deletedAt: true,
      managerReply: true,
      managerRepliedAt: true,
      pitch: { select: { name: true, company: { select: { ownerId: true, name: true } } } },
    },
  })
  if (!review || review.deletedAt || review.pitch.company.ownerId !== managerId) {
    throw notFound('api.reviewNotFound')
  }
  return review
}

export async function createReply(
  reviewId: string,
  managerId: string,
  text: string,
  now: Date = new Date()
): Promise<void> {
  const review = await ownedReview(reviewId, managerId)
  // Only the first of two racing replies lands: the update requires no reply yet.
  const { count } = await prisma.review.updateMany({
    where: { id: reviewId, managerReply: null },
    data: { managerReply: text, managerRepliedAt: now },
  })
  if (!count) {
    throw new ApiException('CONFLICT', 'api.hasReply', {
      reason: 'ALREADY_REPLIED',
    })
  }
  await notify(prisma, {
    userId: review.playerId,
    type: 'MANAGER_REPLIED',
    title: t => t('notify.managerReplied.title', { company: review.pitch.company.name }),
    body: t => t('notify.managerReplied.body', { pitch: review.pitch.name }),
    data: { reviewId },
  })
  deliverSoon([review.playerId])
}

export async function updateReply(
  reviewId: string,
  managerId: string,
  text: string,
  now: Date = new Date()
): Promise<void> {
  const review = await ownedReview(reviewId, managerId)
  if (!review.managerReply || !review.managerRepliedAt) throw notFound('api.replyNotFound')
  const deadline = review.managerRepliedAt.getTime() + REVIEW.REPLY_EDIT_WINDOW_HOURS * HOUR
  if (now.getTime() >= deadline) {
    throw new ApiException(
      'VALIDATION_ERROR',
      'api.replyEditWindow',
      { reason: 'EDIT_WINDOW_CLOSED' },
      { n: REVIEW.REPLY_EDIT_WINDOW_HOURS }
    )
  }
  // The edit window keeps counting from the first reply.
  await prisma.review.update({ where: { id: reviewId }, data: { managerReply: text } })
}

export async function deleteReply(reviewId: string, managerId: string): Promise<void> {
  const review = await ownedReview(reviewId, managerId)
  if (!review.managerReply) throw notFound('api.replyNotFound')
  await prisma.review.update({
    where: { id: reviewId },
    data: { managerReply: null, managerRepliedAt: null },
  })
}
