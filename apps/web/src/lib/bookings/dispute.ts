/**
 * A player disputes a no-show — E06-04. Allowed once, within
 * NO_SHOW_DISPUTE_WINDOW_HOURS of the manager reporting it (PRD §9.4: 24
 * hours; the ticket's 48 is not used). Every admin is notified; resolving it
 * is E15.
 */
import 'server-only'
import { NO_SHOW_DISPUTE_WINDOW_HOURS, bookingReference } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'

export async function disputeNoShow(
  bookingId: string,
  playerId: string,
  disputeText: string,
  now: Date = new Date()
): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { playerId: true, status: true, noShow: true },
  })
  if (!booking || booking.playerId !== playerId) throw notFound('Booking not found')
  if (booking.status !== 'NO_SHOW' || !booking.noShow) {
    throw new ApiException('VALIDATION_ERROR', 'Only a no-show can be disputed', {
      reason: 'NOT_A_NO_SHOW',
    })
  }
  if (booking.noShow.disputeStatus !== 'NONE') {
    throw new ApiException('CONFLICT', 'This no-show has already been disputed', {
      reason: 'ALREADY_DISPUTED',
    })
  }
  const deadline = booking.noShow.createdAt.getTime() + NO_SHOW_DISPUTE_WINDOW_HOURS * 3_600_000
  if (now.getTime() > deadline) {
    throw new ApiException(
      'VALIDATION_ERROR',
      `No-shows can be disputed for ${NO_SHOW_DISPUTE_WINDOW_HOURS} hours`,
      { reason: 'DISPUTE_WINDOW_CLOSED' }
    )
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', deletedAt: null },
    select: { id: true },
  })
  await prisma.$transaction(async tx => {
    await tx.noShow.update({
      where: { bookingId },
      data: { disputeStatus: 'OPEN', disputeText },
    })
    for (const a of admins) {
      await notify(tx, {
        userId: a.id,
        type: 'DISPUTE_OPENED',
        title: 'No-show disputed',
        body: `A player disputes the no-show on booking ${bookingReference(bookingId)}.`,
        data: { bookingId, link: '/admin/disputes' },
      })
    }
  })
  deliverSoon(admins.map(a => a.id))
}
