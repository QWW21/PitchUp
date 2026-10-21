/**
 * Booking confirmed — the email of the BOOKING_CONFIRMED notification
 * (E05-08, E13), in the player's language. The cancellation line is the
 * booking's own policy (C-10), as the booking page states it.
 */
import 'server-only'
import { formatDateLong, formatDuration, type BookingDetail, type Locale } from '@pitchup/shared'
import { webT } from '@/i18n/catalog'
import { renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'
import type { VerificationEmail } from './verification'

export function renderBookingConfirmedEmail(b: BookingDetail, locale: Locale): VerificationEmail {
  const t = webT(locale)
  const when = t('email.bookingConfirmed.when', {
    date: formatDateLong(b.date, locale),
    start: b.startTime,
    end: b.endTime,
    duration: formatDuration(b.minutes),
  })
  const lines = [
    t('email.bookingConfirmed.pitchAt', { pitch: b.pitch.name, company: b.company.name }),
    `${b.company.address}, ${b.company.city}`,
    when,
    ...(b.airType ? [t(`air.${b.airType}`)] : []),
    t('email.bookingConfirmed.teams', { count: b.teamCount }),
    ...(b.shirtSets > 0 ? [t('email.bookingConfirmed.shirts', { count: b.shirtSets })] : []),
    b.paymentMethod === 'ONLINE'
      ? t('email.bookingConfirmed.paid', { total: b.total })
      : b.deposit
        ? t('email.bookingConfirmed.depositPaid', {
            deposit: b.deposit,
            refund:
              b.paymentMethod === 'VENUE_REFUND_DEPOSIT'
                ? t('email.bookingConfirmed.depositRefunded')
                : '',
            due: b.dueAtVenue,
          })
        : t('email.bookingConfirmed.toPay', { due: b.dueAtVenue }),
  ]
  const policy = t('email.bookingConfirmed.policy', { policy: b.refundPolicy })
  return {
    subject: t('email.bookingConfirmed.subject', {
      pitch: b.pitch.name,
      date: b.date,
      time: b.startTime,
    }),
    html: renderEmailLayout(locale, {
      heading: t('email.bookingConfirmed.heading'),
      bodyHtml:
        renderParagraph(t('email.bookingConfirmed.reference', { reference: b.reference })) +
        lines.map(renderParagraph).join('') +
        renderMutedParagraph(policy),
      footerNote: t('email.bookingConfirmed.footer'),
    }),
    text:
      `${t('email.bookingConfirmed.textHeading', { reference: b.reference })}\n\n` +
      lines.join('\n') +
      `\n\n${policy}`,
  }
}
