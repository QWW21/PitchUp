import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache, type ReactNode } from 'react'
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  MapPin,
  NotebookPen,
  Phone,
  Shirt,
  Users,
  XCircle,
} from 'lucide-react'
import {
  SHIRT_COLOUR_HEX,
  SIZE_LABELS,
  SURFACE_LABELS,
  formatDateLong,
  formatDuration,
  type BookingDetail,
  type BookingStatus,
  type PitchSize,
  type ShirtColour,
} from '@pitchup/shared'
import { auth } from '@/auth'
import { ApiException } from '@/lib/api/errors'
import { getBookingForViewer } from '@/lib/bookings/read'
import { Stars } from '@/components/venue/bits'
import { BookingActions, ReviewActions } from '@/components/bookings/BookingActions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ reviewed?: string; cancelled?: string }>
}

const load = cache(async (id: string) => {
  const session = await auth()
  if (!session?.user) return null
  return getBookingForViewer(id, { id: session.user.id, role: session.user.role }).catch(caught => {
    if (caught instanceof ApiException && caught.code === 'NOT_FOUND') return null
    throw caught
  })
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await load((await params).id)
  return { title: b ? `Booking ${b.reference} | PitchUp` : 'Booking not found | PitchUp' }
}

const BANNER: Record<
  BookingStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  CONFIRMED: {
    label: 'Confirmed',
    className: 'bg-primary-50 text-primary-700',
    Icon: CheckCircle2,
  },
  PENDING: { label: 'Awaiting payment', className: 'bg-warning-50 text-amber-800', Icon: Clock },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-primary-50 text-primary-700',
    Icon: CheckCircle2,
  },
  CANCELLED: { label: 'Cancelled', className: 'bg-neutral-100 text-neutral-700', Icon: XCircle },
  NO_SHOW: { label: 'No-show', className: 'bg-error-50 text-error-600', Icon: AlertCircle },
}

const STATUS_WORDS: Record<BookingStatus, string> = {
  PENDING: 'Booked, awaiting payment',
  CONFIRMED: 'Paid and confirmed',
  COMPLETED: 'Played',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'Marked as a no-show',
}

const stamp = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
})

/** Booking detail — E06-10 (UIUX_SPEC §8.2, adapted for the web). */
export default async function BookingDetailPage({ params, searchParams }: Props) {
  const [{ id }, flags] = await Promise.all([params, searchParams])
  const b = await load(id)
  if (!b) notFound()

  const banner = BANNER[b.status]
  const players = b.teams.reduce((n, t) => n + (t.players ?? 0), 0)

  return (
    <article className="mx-auto max-w-xl space-y-5">
      <Link
        href="/my-bookings"
        className="inline-flex h-11 items-center gap-1 text-sm font-medium text-neutral-700 hover:text-neutral-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        My bookings
      </Link>

      {flags.reviewed && (
        <p role="status" className="rounded-md bg-primary-50 p-3 text-sm text-primary-700">
          Thanks! Your review is published.
        </p>
      )}
      {flags.cancelled && (
        <p role="status" className="rounded-md bg-primary-50 p-3 text-sm text-primary-700">
          Booking cancelled.
          {b.payment.refundAmount
            ? ` ${b.payment.refundAmount} RON will be refunded to your card within 5–10 business days.`
            : ' No refund applies.'}
        </p>
      )}

      <div
        className={`flex h-12 items-center justify-center gap-1.5 rounded-lg text-sm font-medium ${banner.className}`}
      >
        <banner.Icon className="h-4 w-4" aria-hidden="true" />
        {banner.label}
      </div>

      <header className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900">Booking details</h1>
        <p className="font-mono text-xs text-neutral-700">{b.reference}</p>
      </header>

      <section aria-label="Venue" className="flex items-center gap-4">
        {b.company.logoUrl ? (
          // Venue logos come from Cloudinary or seed URLs; next/image would need each host configured.
          <img src={b.company.logoUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-neutral-100">
            <Building2 className="h-6 w-6 text-neutral-500" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <Link
            href={`/discover/${b.company.id}`}
            className="text-lg font-semibold text-neutral-900 hover:underline"
          >
            {b.company.name}
          </Link>
          <p className="text-sm text-neutral-700">
            {b.company.address}, {b.company.city}
          </p>
          {b.company.phone && (
            <a
              href={`tel:${b.company.phone}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {b.company.phone}
            </a>
          )}
        </div>
      </section>

      <ul className="space-y-3 rounded-xl bg-neutral-100 p-4 text-sm text-neutral-900">
        <Row icon={<CalendarDays />}>{formatDateLong(b.date)}</Row>
        <Row icon={<Clock />}>
          {b.startTime}–{b.endTime} · {formatDuration(b.minutes)}
        </Row>
        <Row icon={<MapPin />}>
          <Link href={`/discover/${b.company.id}/${b.pitch.id}`} className="hover:underline">
            {b.pitch.name}
          </Link>{' '}
          · {SURFACE_LABELS[b.pitch.surfaceType]} ·{' '}
          {SIZE_LABELS[b.pitch.size as PitchSize] ?? b.pitch.size}
        </Row>
        <Row icon={<Users />}>
          {b.teamCount} teams{players ? ` · ${players} players` : ''}
        </Row>
        {b.shirtSets > 0 && (
          <Row icon={<Shirt />}>
            <span>
              Free shirts: {b.shirtSets} {b.shirtSets === 1 ? 'set' : 'sets'}
              {b.teams.some(t => t.colour) && (
                <span className="mt-1 block space-y-1">
                  {b.teams
                    .filter(t => t.colour)
                    .map(t => (
                      <span key={t.name} className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-4 w-4 rounded-full border border-neutral-200"
                          style={{ background: SHIRT_COLOUR_HEX[t.colour as ShirtColour] }}
                        />
                        {t.name}: {t.colour!.toLowerCase()} shirts
                      </span>
                    ))}
                </span>
              )}
            </span>
          </Row>
        )}
        {b.note && <Row icon={<NotebookPen />}>{b.note}</Row>}
      </ul>

      <section aria-labelledby="payment-heading" className="rounded-xl bg-white p-4 shadow-sm">
        <h2 id="payment-heading" className="text-base font-semibold text-neutral-900">
          Payment
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between text-neutral-700">
            <dt>Pitch ({formatDuration(b.minutes)})</dt>
            <dd>{b.total} RON</dd>
          </div>
          {b.shirtSets > 0 && (
            <div className="flex justify-between text-neutral-700">
              <dt>Shirts</dt>
              <dd>Free</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold text-neutral-900">
            <dt>{b.paidAt && b.paymentMethod === 'ONLINE' ? 'Total paid' : 'Total'}</dt>
            <dd className="font-mono">{b.total} RON</dd>
          </div>
          {b.paymentMethod !== 'ONLINE' && !!b.deposit && (
            <div className="flex justify-between text-neutral-700">
              <dt>
                Deposit paid online
                {b.paymentMethod === 'VENUE_REFUND_DEPOSIT' && ', refunded after the game'}
              </dt>
              <dd>{b.deposit} RON</dd>
            </div>
          )}
          {b.paymentMethod !== 'ONLINE' && (
            <div className="flex justify-between font-medium text-neutral-900">
              <dt>{b.attendedAt ? 'Paid at the venue' : 'To pay at the venue'}</dt>
              <dd>{b.dueAtVenue} RON</dd>
            </div>
          )}
          {b.paidAt && (
            <div className="flex justify-between text-neutral-700">
              <dt>Card</dt>
              <dd className="flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                {b.payment.cardLast4
                  ? `${b.payment.cardBrand ?? 'Card'} ···· ${b.payment.cardLast4}`
                  : b.payment.provider === 'test'
                    ? 'Test payment'
                    : 'Card'}
              </dd>
            </div>
          )}
          {b.paidAt && (
            <div className="flex justify-between text-neutral-700">
              <dt>Paid on</dt>
              <dd>{stamp.format(new Date(b.paidAt))}</dd>
            </div>
          )}
          {b.payment.refundAmount !== null && (
            <div className="flex justify-between font-medium text-primary-700">
              <dt>Refund</dt>
              <dd>{b.payment.refundAmount} RON</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-base font-semibold text-neutral-900">
          History
        </h2>
        <ol className="mt-3">
          {b.statusHistory.map((s, i) => (
            <li key={`${s.status}-${s.at}`} className="relative flex gap-3 pb-4 last:pb-0">
              {i < b.statusHistory.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[4.5px] top-3 h-full w-px bg-neutral-200"
                />
              )}
              <span
                aria-hidden="true"
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary-600"
              />
              <span className="text-sm">
                <span className="font-medium text-neutral-900">{STATUS_WORDS[s.status]}</span>
                <span className="block text-neutral-700">{stamp.format(new Date(s.at))}</span>
              </span>
            </li>
          ))}
        </ol>
        {b.cancellationReason && b.status === 'CANCELLED' && (
          <p className="mt-2 text-sm text-neutral-700">{b.cancellationReason}</p>
        )}
      </section>

      {b.review && <ReviewSection booking={b} />}

      <BookingActions booking={b} />
    </article>
  )
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 text-neutral-500 [&>svg]:h-5 [&>svg]:w-5" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}

function ReviewSection({ booking: b }: { booking: BookingDetail }) {
  const r = b.review!
  return (
    <section aria-labelledby="review-heading" className="rounded-xl bg-white p-4 shadow-sm">
      <h2 id="review-heading" className="text-base font-semibold text-neutral-900">
        Your review
      </h2>
      <div className="mt-2 flex items-center gap-2">
        <Stars rating={r.rating} size={18} />
        {r.isAnonymous && <span className="text-xs text-neutral-700">Posted anonymously</span>}
      </div>
      {r.text && <p className="mt-2 text-sm text-neutral-900">{r.text}</p>}
      <ReviewActions bookingId={b.id} reviewId={r.id} editableUntil={r.editableUntil} />
    </section>
  )
}
