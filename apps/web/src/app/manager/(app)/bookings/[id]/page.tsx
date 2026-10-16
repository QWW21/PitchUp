import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Phone } from 'lucide-react'
import { formatDateLong, formatShortDuration, paymentStatusLine } from '@pitchup/shared'
import { ApiException } from '@/lib/api/errors'
import { requireActiveManager } from '@/lib/manager/access'
import { managerBookingDetail } from '@/lib/manager/bookings'
import { BookingStatusBadge } from '@/components/manager/BookingStatusBadge'
import { BookingActions } from '@/components/manager/BookingActions'

export const metadata: Metadata = { title: 'Booking | PitchUp' }

const STATUS_WORDS: Record<string, string> = {
  PENDING: 'Booked, awaiting payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Played',
  NO_SHOW: 'Reported as a no-show',
}

const stamp = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
})

/** One booking for its venue's manager — E11-08. Another venue's goes back to the list. */
export default async function ManagerBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const b = await managerBookingDetail(company.id, id).catch(caught => {
    if (caught instanceof ApiException && caught.code === 'NOT_FOUND') redirect('/manager/bookings')
    throw caught
  })
  const h = b.player.history

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/manager/bookings"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to bookings
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">Booking {b.reference}</h1>
        <BookingStatusBadge status={b.status} attended={!!b.attendedAt} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="details-h" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="details-h" className="text-base font-semibold text-neutral-900">
            Booking
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Pitch">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: b.pitch.color }}
                />
                {b.pitch.name}
              </span>
            </Row>
            <Row label="Date">{formatDateLong(b.date)}</Row>
            <Row label="Time">
              {b.startTime}–{b.endTime} ({formatShortDuration(b.minutes)})
            </Row>
            <Row label="Teams">
              {b.teams
                .map(
                  t =>
                    `${t.name}${t.players ? ` (${t.players})` : ''}${t.colour ? `, ${t.colour.toLowerCase()} shirts` : ''}`
                )
                .join(' · ')}
            </Row>
            <Row label="Shirts">
              {b.shirtSets ? `${b.shirtSets} ${b.shirtSets === 1 ? 'set' : 'sets'}` : 'None'}
            </Row>
            {b.note && <Row label="Note">{b.note}</Row>}
            {b.cancellationReason && <Row label="Cancelled">{b.cancellationReason}</Row>}
          </dl>
        </section>

        <section aria-labelledby="player-h" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="player-h" className="text-base font-semibold text-neutral-900">
            Player
          </h2>
          <p className="mt-3 font-medium text-neutral-900">{b.player.name}</p>
          {b.player.phone && (
            <a
              href={`tel:${b.player.phone}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:underline"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {b.player.phone}
            </a>
          )}
          <p className="mt-3 text-sm text-neutral-700">
            With you: {h.bookings} {h.bookings === 1 ? 'booking' : 'bookings'}, {h.completed}{' '}
            played, {h.noShows} {h.noShows === 1 ? 'no-show' : 'no-shows'}, {h.lateCancels} late{' '}
            {h.lateCancels === 1 ? 'cancellation' : 'cancellations'}.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            PitchUp doesn&rsquo;t show players&rsquo; trust scores to venues; it blocks unreliable
            players from booking.
          </p>
        </section>

        <section aria-labelledby="payment-h" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="payment-h" className="text-base font-semibold text-neutral-900">
            Payment
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label="Price">{b.total} RON</Row>
            <Row label="PitchUp commission">{b.platformFee} RON</Row>
            <Row label="You receive">
              <strong>{b.venuePayout} RON</strong>
            </Row>
            <Row label="How it's paid">{paymentStatusLine(b)}</Row>
            {b.refundAmount !== null && <Row label="Refunded">{b.refundAmount} RON</Row>}
          </dl>
        </section>

        <section aria-labelledby="actions-h" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="actions-h" className="text-base font-semibold text-neutral-900">
            Actions
          </h2>
          <BookingActions booking={b} />
        </section>
      </div>

      <section aria-labelledby="history-h" className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="history-h" className="text-base font-semibold text-neutral-900">
          History
        </h2>
        <ol className="mt-3 space-y-2 text-sm">
          {b.statusHistory.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600"
              />
              <span>
                <span className="font-medium text-neutral-900">{STATUS_WORDS[e.status]}</span>{' '}
                <span className="text-neutral-500">{stamp.format(new Date(e.at))}</span>
              </span>
            </li>
          ))}
        </ol>
        {b.noShow && (
          <p className="mt-3 text-sm text-neutral-700">
            No-show{b.noShow.reason ? `: ${b.noShow.reason}` : ''}.
            {b.noShow.disputeStatus === 'OPEN' &&
              ' The player has disputed it; PitchUp will review.'}
          </p>
        )}
        {b.review && (
          <p className="mt-3 text-sm text-neutral-700">
            Review: {'★'.repeat(b.review.rating)}
            {b.review.text ? ` “${b.review.text}”` : ''}
          </p>
        )}
      </section>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-36 shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{children}</dd>
    </div>
  )
}
