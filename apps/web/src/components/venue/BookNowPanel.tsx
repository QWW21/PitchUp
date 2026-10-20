'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  addDays,
  dayOfWeek,
  venueClock,
  weekdayLong,
  weekdayShort,
  type PitchAvailability,
} from '@pitchup/shared'
import { useLocale, useT } from '@/i18n/client'

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
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? res.statusText)
  return body.data as PitchAvailability
}

interface BookNowPanelProps {
  pitchId: string
  hourlyRate: number
  signedIn: boolean
  block: BookingBlock
  /** Why this player can't book here (E12-06). */
  blockNote?: string | undefined
  /** The tier this pitch asks for, when it asks for one. */
  minTier?: string | null
  /** C-10: the venue's refund policy, in a sentence. */
  refundPolicy: string
  /** C-13: the venue confirms each booking by hand. */
  confirmsByHand?: boolean
}

/**
 * Price, today + six days of availability, and Book Now. Sticky beside the
 * gallery on desktop, a full-width section on small screens. E04-08.
 */
export function BookNowPanel({
  pitchId,
  hourlyRate,
  signedIn,
  block,
  blockNote,
  minTier,
  refundPolicy,
  confirmsByHand,
}: BookNowPanelProps) {
  const t = useT()
  const locale = useLocale()
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

  // Book Now leads to the booking flow (E05), on the day tapped if any.
  // Signed-out players sign in first and come back to the same place.
  const bookingPath = (date?: string) => `/book/${pitchId}/date${date ? `?date=${date}` : ''}`
  const hrefFor = (date?: string) =>
    signedIn ? bookingPath(date) : `/login?callbackUrl=${encodeURIComponent(bookingPath(date))}`

  return (
    <aside className="rounded-xl bg-white p-5 shadow-sm lg:sticky lg:top-24">
      <p className="text-sm text-neutral-500">
        <span className="font-mono text-xl font-bold text-neutral-900">{hourlyRate} RON</span>
        {t('venue.pricing.perHour')}
      </p>

      {block !== 'unavailable' && (
        <>
          <h2 className="mt-5 text-base font-semibold text-neutral-900">
            {t('venue.bookNow.availability')}
          </h2>
          <ol className="mt-3 grid grid-cols-7 gap-1">
            {dates.map((date, i) => {
              const q = days[i]!
              const state = stateOf(q.data, q.isError)
              const dow = dayOfWeek(date)
              const label = i === 0 ? t('venue.bookNow.today') : weekdayShort(dow, locale)
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
              const aria = `${weekdayLong(dow, locale)} ${date}: ${t(`venue.bookNow.state.${state}`)}`
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
                            ? (blockNote ?? t('venue.bookNow.cannotBook'))
                            : i === 0 && q.data && !q.data.isClosed
                              ? t('venue.bookNow.noMoreToday')
                              : t('venue.bookNow.closedOn', {
                                  day: weekdayLong(dow, locale).toLowerCase(),
                                })
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
            <Legend dot="bg-primary-600" label={t('venue.bookNow.legendAvailable')} />
            <Legend dot="bg-error-500" label={t('venue.bookNow.legendFull')} />
            <Legend dot="bg-neutral-300" label={t('venue.bookNow.legendClosed')} />
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
          <span className="flex h-12 w-full items-center justify-center rounded-md bg-neutral-200 font-semibold text-neutral-700">
            {t('venue.bookNow.notAvailable')}
          </span>
        ) : block === 'restricted' ? (
          <>
            <span className="flex h-12 w-full items-center justify-center rounded-md bg-neutral-200 font-semibold text-neutral-700">
              {t('venue.bookNow.cantBookHere')}
            </span>
            <p className="mt-2 text-sm text-neutral-700">
              {blockNote ?? t('venue.bookNow.cannotBook')}{' '}
              <Link href="/profile/trust-score" className="font-medium text-primary-700 underline">
                {t('venue.bookNow.trustScoreLink')}
              </Link>
            </p>
          </>
        ) : (
          <Link
            href={hrefFor()}
            className="flex h-12 w-full items-center justify-center rounded-md bg-accent-600 font-semibold text-white hover:bg-accent-700"
          >
            {signedIn ? t('venue.bookNow.book') : t('venue.bookNow.signInToBook')}
          </Link>
        )}
      </div>
      {minTier && (
        <p className="mt-3 text-xs text-neutral-700">
          {t('venue.bookNow.minTier', { tier: minTier })}
        </p>
      )}
      {confirmsByHand && (
        <p className="mt-3 text-xs text-neutral-700">{t('venue.bookNow.confirmsByHand')}</p>
      )}
      <p className="mt-3 text-xs text-neutral-500">{refundPolicy}</p>
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
