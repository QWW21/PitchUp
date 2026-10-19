/** Booking confirmed — the email of the BOOKING_CONFIRMED notification (E05-08, E13). */
import 'server-only'
import { formatDateLong, formatDuration, type BookingConfirmation } from '@pitchup/shared'
import { renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'
import type { VerificationEmail } from './verification'

const when = (b: BookingConfirmation) =>
  `${formatDateLong(b.date)}, ${b.startTime}–${b.endTime} (${formatDuration(b.minutes)})`

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
    b.paymentMethod === 'ONLINE'
      ? `Paid: ${b.total} RON`
      : b.deposit
        ? `Deposit paid: ${b.deposit} RON${b.paymentMethod === 'VENUE_REFUND_DEPOSIT' ? ', refunded after the game' : ''}. To pay at the venue: ${b.dueAtVenue} RON.`
        : `To pay at the venue: ${b.dueAtVenue} RON.`,
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
