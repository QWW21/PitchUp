'use client'

/**
 * One booking in My Bookings — E06-10 (UIUX_SPEC §8.1, adapted for the web).
 * The whole card links to the detail; actions sit inside it as separate links.
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Building2, CalendarDays, Clock, Timer } from 'lucide-react'
import {
  formatCountdown,
  formatDateLong,
  type BookingListItem,
  type BookingStatus,
} from '@pitchup/shared'

const STATUS: Record<BookingStatus, { label: string; className: string }> = {
  CONFIRMED: { label: 'Confirmed', className: 'bg-primary-50 text-primary-700' },
  PENDING: { label: 'Awaiting payment', className: 'bg-warning-50 text-amber-800' },
  COMPLETED: { label: 'Completed', className: 'bg-primary-50 text-primary-700' },
  NO_SHOW: { label: 'No-show', className: 'bg-error-50 text-error-600' },
  CANCELLED: { label: 'Cancelled', className: 'bg-neutral-100 text-neutral-700' },
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS[status]
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.className}`}>{s.label}</span>
  )
}

/** "Starts in 3h 20min", refreshed every minute, for bookings within 24 hours. */
function Countdown({ startsAt }: { startsAt: string }) {
  const start = new Date(startsAt)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  if (start.getTime() - now.getTime() > 24 * 3_600_000) return null
  const text = formatCountdown(start, now)
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 text-xs font-medium text-amber-800">
      <Timer className="h-3.5 w-3.5" aria-hidden="true" />
      {text === 'Starting now' ? text : `Starts in ${text}`}
    </span>
  )
}

const cancelledByText = {
  PLAYER: 'Cancelled by you',
  MANAGER: 'Cancelled by the venue',
  ADMIN: 'Cancelled by PitchUp',
  SYSTEM: 'Cancelled',
} as const

export function BookingCard({ booking: b }: { booking: BookingListItem }) {
  const detail = `/my-bookings/${b.id}`
  return (
    <article className="relative rounded-xl border border-neutral-200 bg-white p-4 transition-colors duration-150 hover:bg-neutral-50">
      <div className="flex items-start gap-3">
        {b.company.logoUrl ? (
          <img src={b.company.logoUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100">
            <Building2 className="h-5 w-5 text-neutral-500" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-neutral-700">{b.company.name}</p>
          <h2 className="font-semibold text-neutral-900">
            {/* The card's main link; it covers the whole card. */}
            <Link href={detail} className="after:absolute after:inset-0 after:rounded-xl">
              {b.pitch.name}
            </Link>
          </h2>
        </div>
        {b.status !== 'CANCELLED' && <StatusBadge status={b.status} />}
      </div>

      <dl className="mt-3 space-y-1 text-sm text-neutral-700">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Date</dt>
          <CalendarDays className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <dd>{formatDateLong(b.date)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Time</dt>
          <Clock className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <dd>
            {b.startTime}–{b.endTime}
          </dd>
        </div>
      </dl>

      {(b.status === 'CONFIRMED' || b.status === 'PENDING') && (
        <div className="mt-3">
          <Countdown startsAt={b.startsAt} />
        </div>
      )}

      {b.status === 'CANCELLED' && (
        <p className="mt-3 text-sm text-neutral-700">
          <span className="italic">{cancelledByText[b.cancelledBy ?? 'SYSTEM']}</span>
          {' · '}
          {b.refundAmount ? (
            <span className="font-medium text-primary-700">Refund: {b.refundAmount} RON</span>
          ) : (
            'No refund'
          )}
        </p>
      )}

      {(b.status === 'COMPLETED' || b.status === 'NO_SHOW') && (
        <div className="relative mt-3 flex items-center justify-between gap-2">
          {b.canReview ? (
            <Link
              href={`${detail}/review`}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
            >
              Leave a review
            </Link>
          ) : (
            <span />
          )}
          <Link
            href={`/book/${b.pitch.id}/date`}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-50"
          >
            Book again
          </Link>
        </div>
      )}
    </article>
  )
}
