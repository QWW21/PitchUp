import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Phone } from 'lucide-react'
import {
  INTL_LOCALE,
  formatDateLong,
  formatShortDuration,
  paymentStatusLine,
  sharedT,
} from '@pitchup/shared'
import { ApiException } from '@/lib/api/errors'
import { requireActiveManager } from '@/lib/manager/access'
import { managerBookingDetail } from '@/lib/manager/bookings'
import { BookingStatusBadge } from '@/components/manager/BookingStatusBadge'
import { BookingActions } from '@/components/manager/BookingActions'
import { getLocale, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('mBookings.detail.title') }
}

/** One booking for its venue's manager — E11-08. Another venue's goes back to the list. */
export default async function ManagerBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const locale = await getLocale()
  const t = await getT()
  const stamp = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  })
  const colour = (c: string) => {
    const st = sharedT(locale)
    const key = `shirt.${c}` as 'shirt.RED'
    return st.has(key) ? st(key) : c.toLowerCase()
  }
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
          {t('mBookings.detail.back')}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">
          {t('mBookings.detail.heading', { reference: b.reference })}
        </h1>
        <BookingStatusBadge status={b.status} attended={!!b.attendedAt} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="details-h" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="details-h" className="text-base font-semibold text-neutral-900">
            {t('mBookings.detail.booking')}
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label={t('mBookings.detail.pitch')}>
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: b.pitch.color }}
                />
                {b.pitch.name}
              </span>
            </Row>
            <Row label={t('mBookings.detail.date')}>{formatDateLong(b.date, locale)}</Row>
            <Row label={t('mBookings.detail.time')}>
              {b.startTime}–{b.endTime} ({formatShortDuration(b.minutes)})
            </Row>
            <Row label={t('mBookings.detail.teams')}>
              {b.teams
                .map(
                  team =>
                    `${team.name}${team.players ? ` (${team.players})` : ''}${team.colour ? t('mBookings.detail.shirtsOf', { colour: colour(team.colour) }) : ''}`
                )
                .join(' · ')}
            </Row>
            <Row label={t('mBookings.detail.shirts')}>
              {b.shirtSets
                ? t('mBookings.detail.sets', { count: b.shirtSets })
                : t('mBookings.detail.none')}
            </Row>
            {b.note && <Row label={t('mBookings.detail.note')}>{b.note}</Row>}
            {b.cancellationReason && (
              <Row label={t('mBookings.detail.cancelled')}>{b.cancellationReason}</Row>
            )}
          </dl>
        </section>

        <section aria-labelledby="player-h" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="player-h" className="text-base font-semibold text-neutral-900">
            {t('mBookings.detail.player')}
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
            {t('mBookings.detail.withYou', {
              bookings: t('mBookings.detail.bookings', { count: h.bookings }),
              completed: h.completed,
              noShows: t('mBookings.detail.noShows', { count: h.noShows }),
              lateCancels: t('mBookings.detail.lateCancels', { count: h.lateCancels }),
            })}
          </p>
          <p className="mt-1 text-xs text-neutral-500">{t('mBookings.detail.noScores')}</p>
        </section>

        <section aria-labelledby="payment-h" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="payment-h" className="text-base font-semibold text-neutral-900">
            {t('mBookings.detail.payment')}
          </h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row label={t('mBookings.detail.price')}>
              {b.total} RON{b.airType && ` · ${t(`air.${b.airType}`)}`}
            </Row>
            <Row label={t('mBookings.detail.commission')}>{b.platformFee} RON</Row>
            <Row label={t('mBookings.detail.receive')}>
              <strong>{b.venuePayout} RON</strong>
            </Row>
            <Row label={t('mBookings.detail.howPaid')}>{paymentStatusLine(b, locale)}</Row>
            {b.refundAmount !== null && (
              <Row label={t('mBookings.detail.refunded')}>{b.refundAmount} RON</Row>
            )}
          </dl>
        </section>

        <section aria-labelledby="actions-h" className="rounded-xl bg-white p-5 shadow-sm">
          <h2 id="actions-h" className="text-base font-semibold text-neutral-900">
            {t('mBookings.detail.actions')}
          </h2>
          <BookingActions booking={b} />
        </section>
      </div>

      <section aria-labelledby="history-h" className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 id="history-h" className="text-base font-semibold text-neutral-900">
          {t('mBookings.detail.timeline')}
        </h2>
        <ol className="mt-3 space-y-2 text-sm">
          {b.statusHistory.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600"
              />
              <span>
                <span className="font-medium text-neutral-900">
                  {t(`mBookings.detail.history.${e.status}`)}
                </span>{' '}
                <span className="text-neutral-500">{stamp.format(new Date(e.at))}</span>
              </span>
            </li>
          ))}
        </ol>
        {b.noShow && (
          <p className="mt-3 text-sm text-neutral-700">
            {b.noShow.reason
              ? t('mBookings.detail.noShowWhy', { reason: b.noShow.reason })
              : t('mBookings.detail.noShowPlain')}
            {b.noShow.disputeStatus === 'OPEN' && t('mBookings.detail.disputed')}
          </p>
        )}
        {b.review && (
          <p className="mt-3 text-sm text-neutral-700">
            {t('mBookings.detail.review', { stars: '★'.repeat(b.review.rating) })}
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
