/**
 * The 24-hour reminder — E13-04. Run hourly: every confirmed booking that
 * starts 23 to 25 hours from now and hasn't been reminded gets one. The
 * window is two hours wide so a late or missed run still catches it, and
 * `reminderSentAt` (claimed before sending) means it never goes twice.
 */
import 'server-only'
import { fromMinutes, venueClock } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notify } from './dispatch'

const HOUR = 3_600_000

export async function queueReminders(now: Date = new Date()): Promise<{ reminded: number }> {
  const due = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      reminderSentAt: null,
      startTime: {
        gte: new Date(now.getTime() + 23 * HOUR),
        lte: new Date(now.getTime() + 25 * HOUR),
      },
    },
    orderBy: { startTime: 'asc' },
    take: 200,
    select: {
      id: true,
      playerId: true,
      startTime: true,
      pitch: { select: { name: true, company: { select: { name: true } } } },
    },
  })
  let reminded = 0
  for (const b of due) {
    await prisma.$transaction(async tx => {
      const claim = await tx.booking.updateMany({
        where: { id: b.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      })
      if (claim.count !== 1) return
      await notify(tx, {
        userId: b.playerId,
        type: 'BOOKING_REMINDER_24H',
        title: t => t('notify.reminder.title'),
        body: t =>
          t('notify.reminder.body', {
            pitch: b.pitch.name,
            company: b.pitch.company.name,
            time: fromMinutes(venueClock(b.startTime).minutes),
          }),
        data: { bookingId: b.id },
      })
      reminded++
    })
  }
  return { reminded }
}
