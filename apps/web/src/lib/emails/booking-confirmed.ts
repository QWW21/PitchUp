/** Booking confirmed — sent when a payment succeeds (E05-08). */
import 'server-only'
import { DAY_LONG, dayOfWeek, formatDuration, type BookingConfirmation } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { getEmailProvider } from '@/lib/notifications'
import { loadConfirmation } from '@/lib/bookings/read'
import { renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'
import type { VerificationEmail } from './verification'

const when = (b: BookingConfirmation) =>
  `${DAY_LONG[dayOfWeek(b.date)]} ${b.date}, ${b.startTime}–${b.endTime} (${formatDuration(b.minutes)})`

export function renderBookingConfirmedEmail(b: BookingConfirmation): VerificationEmail {
  const shirts =
    b.shirtSets > 0
      ? `Free shirts: ${b.shirtSets} set${b.shirtSets === 1 ? '' : 's'}, ready at the venue.`
      : null
  const lines = [
    `${b.pitch.name} at ${b.company.name}`,
    `${b.company.address}, ${b.company.city}`,
    when(b),
    `${b.teamCount} teams`,
    ...(shirts ? [shirts] : []),
    `Paid: ${b.total} RON`,
  ]
  return {
    subject: `Booking confirmed: ${b.pitch.name}, ${b.date} ${b.startTime}`,
    html: renderEmailLayout({
      heading: 'Your booking is confirmed',
      bodyHtml:
        renderParagraph(`Reference ${b.reference}. See you on the pitch!`) +
        lines.map(renderParagraph).join('') +
        renderMutedParagraph(
          'Cancel at least 24 hours before kick-off for a full refund, or at least 2 hours before for half.'
        ),
      footerNote: 'You are receiving this because you booked a pitch on PitchUp.',
    }),
    text:
      `Your booking is confirmed (${b.reference})\n\n` +
      lines.join('\n') +
      `\n\nCancel at least 24 hours before kick-off for a full refund, or at least 2 hours before for half.`,
  }
}

export async function sendBookingConfirmedEmail(bookingId: string): Promise<void> {
  const [booking, player] = await Promise.all([
    loadConfirmation(bookingId),
    prisma.booking.findUnique({
      where: { id: bookingId },
      select: { player: { select: { email: true } } },
    }),
  ])
  if (!booking || !player) return
  await getEmailProvider().send({
    to: player.player.email,
    ...renderBookingConfirmedEmail(booking),
  })
}
