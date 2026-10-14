'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  CANCELLATION_WINDOWS,
  DAY_LONG,
  DAY_SHORT,
  REFUND_PERCENTAGES,
  addDays,
  dayOfWeek,
  venueClock,
  type PitchAvailability,
} from '@pitchup/shared'

/** Why Book Now is not offered, if it is not. UIUX_SPEC §6.2, PRD §7.4. */
export type BookingBlock = null | 'unavailable' | 'restricted'

type DayState = 'loading' | 'available' | 'full' | 'closed' | 'error'

const DOT: Record<DayState, string> = {
  loading: 'bg-neutral-200 animate-pulse',
  available: 'bg-primary-600',
  full: 'bg-error-500',
  closed: 'bg-neutral-300',
  error: 'bg-neutral-200',
}

const LABEL: Record<DayState, string> = {
  loading: 'checking',
  available: 'slots available',
  full: 'fully booked',
  closed: 'closed',
  error: 'unknown',
}

function stateOf(a: PitchAvailability | undefined, isError: boolean): DayState {
  if (isError) return 'error'
  if (!a) return 'loading'
  if (a.isClosed) return 'closed'
  if (a.slots.some(s => s.status === 'available')) return 'available'
  // Nothing left today because the day is over, not because it sold out.
  if (!a.slots.some(s => s.status === 'booked')) return 'closed'
  return 'full'
}

async function fetchDay(pitchId: string, date: string): Promise<PitchAvailability> {
  const res = await fetch(`/api/v1/pitches/${pitchId}/availability?date=${date}`)
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? 'Request failed')
  return body.data as PitchAvailability
}

interface BookNowPanelProps {
  pitchId: string
  offPeakRate: number
  signedIn: boolean
  block: BookingBlock
}

/**
 * Price, today + six days of availability, and Book Now. Sticky beside the
 * gallery on desktop, a full-width section on small screens. E04-08.
 */
export function BookNowPanel({ pitchId, offPeakRate, signedIn, block }: BookNowPanelProps) {
  // The venue's today, not the browser's: a visitor abroad still sees Romanian dates.
  const today = venueClock(new Date()).date
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const [closedNote, setClosedNote] = useState<string | null>(null)

  const days = useQueries({
    queries: dates.map(date => ({
      queryKey: ['pitch-availability', pitchId, date],
      queryFn: () => fetchDay(pitchId, date),
      staleTime: 60 * 1000,
      enabled: block !== 'unavailable',
    })),
  })

  // Book Now leads to the booking flow (E05). Signed-out players sign in first
  // and come back to the same place.
  const bookingPath = (date?: string) =>
    `/booking/new?pitchId=${pitchId}${date ? `&date=${date}` : ''}`
  const hrefFor = (date?: string) =>
    signedIn ? bookingPath(date) : `/login?callbackUrl=${encodeURIComponent(bookingPath(date))}`

  return (
    <aside className="rounded-xl bg-white p-5 shadow-sm lg:sticky lg:top-24">
      <p className="text-sm text-neutral-500">
        from <span className="font-mono text-xl font-bold text-neutral-900">{offPeakRate} RON</span>
        /h
      </p>

      {block !== 'unavailable' && (
        <>
          <h2 className="mt-5 text-base font-semibold text-neutral-900">Availability</h2>
          <ol className="mt-3 grid grid-cols-7 gap-1">
            {dates.map((date, i) => {
              const q = days[i]!
              const state = stateOf(q.data, q.isError)
              const dow = dayOfWeek(date)
              const label = i === 0 ? 'Today' : DAY_SHORT[dow]
              const content = (
                <>
                  <span
                    className={`text-[11px] font-medium ${i === 0 ? 'text-primary-600' : 'text-neutral-500'}`}
                  >
                    {label}
                  </span>
                  <span className="text-xs text-neutral-700">{Number(date.slice(8))}</span>
                  <span className={`h-2 w-2 rounded-full ${DOT[state]}`} aria-hidden="true" />
                </>
              )
              const cls =
                'flex flex-col items-center gap-1 rounded-md py-2 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600'
              const aria = `${DAY_LONG[dow]} ${date}: ${LABEL[state]}`
              return (
                <li key={date}>
                  {state === 'closed' || block === 'restricted' ? (
                    <button
                      type="button"
                      aria-label={aria}
                      className={`w-full ${cls}`}
                      onClick={() =>
                        setClosedNote(
                          block === 'restricted'
                            ? 'Your account cannot make bookings right now.'
                            : i === 0 && q.data && !q.data.isClosed
                              ? 'No more slots today.'
                              : `This pitch is closed on ${DAY_LONG[dow]}.`
                        )
                      }
                    >
                      {content}
                    </button>
                  ) : (
                    <Link href={hrefFor(date)} aria-label={aria} className={cls}>
                      {content}
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500">
            <Legend dot="bg-primary-600" label="Available" />
            <Legend dot="bg-error-500" label="Full" />
            <Legend dot="bg-neutral-300" label="Closed" />
          </p>
          {closedNote && (
            <p role="status" className="mt-2 text-xs text-neutral-700">
              {closedNote}
            </p>
          )}
        </>
      )}

      <div className="mt-5">
        {block === 'unavailable' ? (
          <span className="flex h-12 w-full items-center justify-center rounded-md bg-neutral-200 font-semibold text-neutral-500">
            Not available
          </span>
        ) : block === 'restricted' ? (
          <span className="flex h-12 w-full items-center justify-center rounded-md bg-neutral-200 font-semibold text-neutral-500">
            Account restricted
          </span>
        ) : (
          <Link
            href={hrefFor()}
            className="flex h-12 w-full items-center justify-center rounded-md bg-accent-500 font-semibold text-white hover:bg-accent-600"
          >
            {signedIn ? 'Book Now' : 'Sign in to book'}
          </Link>
        )}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Free cancellation up to {CANCELLATION_WINDOWS.FULL_REFUND_HOURS}h before kick-off;{' '}
        {REFUND_PERCENTAGES.PARTIAL}% refund up to {CANCELLATION_WINDOWS.PARTIAL_REFUND_HOURS}h
        before.
      </p>
    </aside>
  )
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}
