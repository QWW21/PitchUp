/**
 * Writing reviews — E06-05. One per booking, for a completed booking, within
 * REVIEW.SUBMIT_WINDOW_DAYS of its end (PRD §11.1). Editable by its author
 * for REVIEW.EDIT_WINDOW_HOURS and deletable at any time (E07-06). Published
 * at once (no moderation queue in v1); the venue's manager is notified.
 *
 * Deleting is soft: the row stays (the booking still counts as reviewed)
 * but disappears from every list and rating.
 */
import 'server-only'
import { Prisma } from '@prisma/client'
import { REVIEW, type CreateReviewInput, type UpdateReviewInput } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { applyTrustEvent } from '@/lib/trust/apply'
import { settlePlayerBookings } from '@/lib/bookings/mine'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'

const HOUR = 3_600_000

export async function createReview(
  playerId: string,
  input: CreateReviewInput,
  now: Date = new Date()
): Promise<{ id: string }> {
  // A booking that ended moments ago becomes COMPLETED here.
  await settlePlayerBookings(playerId, now)
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      playerId: true,
      status: true,
      endTime: true,
      pitchId: true,
      review: { select: { id: true } },
      pitch: { select: { name: true, company: { select: { ownerId: true } } } },
    },
  })
  if (!booking || booking.playerId !== playerId) throw notFound('Booking not found')
  if (booking.status !== 'COMPLETED') {
    throw new ApiException('VALIDATION_ERROR', 'Only a completed booking can be reviewed', {
      reason: 'NOT_REVIEWABLE',
    })
  }
  if (now.getTime() > booking.endTime.getTime() + REVIEW.SUBMIT_WINDOW_DAYS * 24 * HOUR) {
    throw new ApiException(
      'VALIDATION_ERROR',
      `Reviews can be left for ${REVIEW.SUBMIT_WINDOW_DAYS} days after the game`,
      { reason: 'REVIEW_WINDOW_CLOSED' }
    )
  }
  if (booking.review) {
    throw new ApiException('CONFLICT', 'You have already reviewed this booking', {
      reason: 'ALREADY_REVIEWED',
    })
  }

  try {
    const review = await prisma.$transaction(async tx => {
      const created = await tx.review.create({
        data: {
          bookingId: input.bookingId,
          pitchId: booking.pitchId,
          playerId,
          rating: input.rating,
          text: input.text ?? null,
          ...(input.photoUrls?.length ? { photoUrls: input.photoUrls } : {}),
          isAnonymous: input.isAnonymous,
          moderationStatus: 'APPROVED',
        },
        select: { id: true },
      })
      // +1 trust, once per booking even if the review is deleted and written again.
      const rewarded = await tx.trustScoreEvent.count({
        where: { userId: playerId, reason: 'REVIEW_LEFT', relatedBookingId: input.bookingId },
      })
      if (!rewarded) await applyTrustEvent(tx, playerId, 'REVIEW_LEFT', input.bookingId, now)
      return created
    })
    await notify(prisma, {
      userId: booking.pitch.company.ownerId,
      type: 'REVIEW_LEFT',
      title: 'New review',
      body: `${input.rating}★ for ${booking.pitch.name}`,
      data: { reviewId: review.id, bookingId: input.bookingId, link: '/manager/reviews' },
    })
    deliverSoon([booking.pitch.company.ownerId, playerId])
    return review
  } catch (caught) {
    // Two submits at once: the database's one-review-per-booking rule wins.
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
      throw new ApiException('CONFLICT', 'You have already reviewed this booking', {
        reason: 'ALREADY_REVIEWED',
      })
    }
    throw caught
  }
}

async function own(
  reviewId: string,
  viewer: { id: string; role: string },
  now: Date,
  { editing }: { editing: boolean }
) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { playerId: true, createdAt: true, deletedAt: true },
  })
  const isAdmin = viewer.role === 'ADMIN'
  if (!review || review.deletedAt || (review.playerId !== viewer.id && !isAdmin)) {
    throw notFound('Review not found')
  }
  if (
    editing &&
    !isAdmin &&
    now.getTime() > review.createdAt.getTime() + REVIEW.EDIT_WINDOW_HOURS * HOUR
  ) {
    throw new ApiException(
      'VALIDATION_ERROR',
      `Reviews can be edited for ${REVIEW.EDIT_WINDOW_HOURS} hours after posting`,
      { reason: 'EDIT_WINDOW_CLOSED' }
    )
  }
}

export async function updateReview(
  reviewId: string,
  viewer: { id: string; role: string },
  input: UpdateReviewInput,
  now: Date = new Date()
): Promise<void> {
  await own(reviewId, viewer, now, { editing: true })
  await prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...('text' in input ? { text: input.text ?? null } : {}),
      ...(input.photoUrls !== undefined ? { photoUrls: input.photoUrls } : {}),
      ...(input.isAnonymous !== undefined ? { isAnonymous: input.isAnonymous } : {}),
    },
  })
}

export async function deleteReview(
  reviewId: string,
  viewer: { id: string; role: string },
  now: Date = new Date()
): Promise<void> {
  await own(reviewId, viewer, now, { editing: false })
  await prisma.review.update({
    where: { id: reviewId },
    data: { deletedAt: now, text: null, photoUrls: Prisma.DbNull },
  })
}
