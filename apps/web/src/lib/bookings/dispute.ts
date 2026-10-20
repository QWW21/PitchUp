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
  if (!booking || booking.playerId !== playerId) throw notFound('api.bookingNotFound')
  if (booking.status !== 'NO_SHOW' || !booking.noShow) {
    throw new ApiException('VALIDATION_ERROR', 'api.disputeNoShowOnly', {
      reason: 'NOT_A_NO_SHOW',
    })
  }
  if (booking.noShow.disputeStatus !== 'NONE') {
    throw new ApiException('CONFLICT', 'api.alreadyDisputed', {
      reason: 'ALREADY_DISPUTED',
    })
  }
  const deadline = booking.noShow.createdAt.getTime() + NO_SHOW_DISPUTE_WINDOW_HOURS * 3_600_000
  if (now.getTime() > deadline) {
    throw new ApiException(
      'VALIDATION_ERROR',
      'api.disputeWindow',
      { reason: 'DISPUTE_WINDOW_CLOSED' },
      { n: NO_SHOW_DISPUTE_WINDOW_HOURS }
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
        title: t => t('notify.disputeOpened.title'),
        body: t => t('notify.disputeOpened.body', { reference: bookingReference(bookingId) }),
        data: { bookingId, link: '/admin/disputes' },
      })
    }
  })
  deliverSoon(admins.map(a => a.id))
}
