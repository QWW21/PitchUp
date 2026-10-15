/**
 * A player's own reviews — E07-02, for "My reviews" on web and mobile.
 * Newest first, no paging (players rarely have more than a few dozen).
 * Whether a review can still be edited is decided here, on the server's
 * clock, so a device with the wrong time cannot open an edit that will fail.
 */
import 'server-only'
import { REVIEW, venueClock, type MyReview } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { photoList } from './shape'

const HOUR = 3_600_000

export async function listMyReviews(playerId: string, now: Date = new Date()): Promise<MyReview[]> {
  const rows = await prisma.review.findMany({
    where: { playerId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      pitch: { select: { id: true, name: true, company: { select: { id: true, name: true } } } },
      booking: { select: { startTime: true } },
    },
  })
  return rows.map(r => {
    const editableUntil = new Date(r.createdAt.getTime() + REVIEW.EDIT_WINDOW_HOURS * HOUR)
    return {
      id: r.id,
      bookingId: r.bookingId,
      rating: r.rating,
      text: r.text,
      isAnonymous: r.isAnonymous,
      photoUrls: photoList(r.photoUrls),
      // Exactly at the deadline it is closed.
      isEditable: now < editableUntil,
      editableUntil: editableUntil.toISOString(),
      reply:
        r.managerReply && r.managerRepliedAt
          ? { text: r.managerReply, createdAt: r.managerRepliedAt.toISOString() }
          : null,
      pitch: { id: r.pitch.id, name: r.pitch.name },
      company: { id: r.pitch.company.id, name: r.pitch.company.name },
      bookingDate: venueClock(r.booking.startTime).date,
      createdAt: r.createdAt.toISOString(),
    }
  })
}
