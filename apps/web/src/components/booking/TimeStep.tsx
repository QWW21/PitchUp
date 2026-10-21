'use client'

/**
 * Step 2: the time — C-6 (replacing E05-10's grid). First how long, then a
 * start time, grouped into morning, afternoon and evening. Only starts with
 * room for the whole length can be picked, so the length chosen is the
 * length booked. Which lengths and starts are possible comes from
 * @pitchup/shared (durationChoices, startOptions), the same rules as the app.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  bookingPrice,
  durationChoices,
  formatShortDuration,
  rangeFrom,
  rangeTimes,
  startOptions,
  type DayPeriod,
  type PitchAvailability,
} from '@pitchup/shared'
import { Button } from '@/components/ui/Button'
import { useT } from '@/i18n/client'
import { stepPath, useBooking } from './draft'

const PERIODS: DayPeriod[] = ['Morning', 'Afternoon', 'Evening']

async function fetchDay(pitchId: string, date: string) {
  // Never cached: a slot booked a moment ago must show as booked.
  const res = await fetch(`/api/v1/pitches/${pitchId}/availability?date=${date}`, {
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? res.statusText)
  return body.data as PitchAvailability
}

const chip = (on: boolean) =>
  `h-11 rounded-md border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${
    on
      ? 'border-primary-600 bg-primary-600 text-white'
      : 'border-neutral-200 bg-white text-neutral-900 hover:border-primary-600 disabled:border-neutral-100 disabled:bg-neutral-100 disabled:text-neutral-500 disabled:line-through'
  }`

export function TimeStep() {
  const t = useT()
  const { pitch, draft, ready, update } = useBooking()
  const router = useRouter()
  const [minutes, setMinutes] = useState<number | null>(null)
  const [startTime, setStartTime] = useState<string | null>(null)

  useEffect(() => {
    if (ready && !draft.date) router.replace(stepPath(pitch.id, 'date'))
  }, [ready, draft.date, pitch.id, router])

  const day = useQuery({
    queryKey: ['booking-slots', pitch.id, draft.date],
    queryFn: () => fetchDay(pitch.id, draft.date!),
    enabled: !!draft.date,
    staleTime: 0,
  })
  const slots = day.data?.slots ?? []
  const minMinutes = pitch.minBookingHours * 60
  const maxMinutes = pitch.maxBookingHours * 60
  const durations = durationChoices(slots, minMinutes, maxMinutes)
  // Starts are judged against the chosen length: a start without room for all
  // of it can't be picked. Kept as a time, not a position in the list, so a
  // refreshed list can never move it.
  const starts = startOptions(slots, minutes ?? minMinutes)
  const startIndex = starts.findIndex(s => s.time === startTime && s.state === 'available')

  // The length starts at the one chosen before, if it still fits somewhere,
  // else the shortest that does; a start chosen before comes back if free.
  useEffect(() => {
    if (!slots.length || minutes !== null) return
    const fitting = durationChoices(slots, minMinutes, maxMinutes).filter(d => d.fits)
    const previous = fitting.find(d => d.minutes === draft.minutes)
    const length = previous?.minutes ?? fitting[0]?.minutes ?? null
    setMinutes(length)
    if (length !== null && draft.startTime) {
      const free = startOptions(slots, length).some(
        s => s.time === draft.startTime && s.state === 'available'
      )
      if (free) setStartTime(draft.startTime)
    }
  }, [slots, minutes, draft.minutes, draft.startTime, minMinutes, maxMinutes])

  const pickLength = (m: number) => {
    setMinutes(m)
    // A start without room for the new length is let go, never shortened.
    if (!startOptions(slots, m).some(s => s.time === startTime && s.state === 'available')) {
      setStartTime(null)
    }
  }

  const chosen =
    startIndex >= 0 && minutes !== null ? rangeTimes(slots, rangeFrom(startIndex, minutes)) : null
  const price = chosen ? bookingPrice(pitch.hourlyRate, chosen.minutes) : null

  const next = () => {
    if (!chosen) return
    update({ startTime: chosen.startTime, endTime: chosen.endTime, minutes: chosen.minutes })
    router.push(stepPath(pitch.id, 'teams'))
  }

  if (!draft.date) return null
  const noneFree =
    day.isSuccess && !startOptions(slots, minMinutes).some(s => s.state === 'available')

  return (
    <section aria-labelledby="time-heading">
      <h1 id="time-heading" className="text-xl font-semibold text-neutral-900">
        {t('booking.time.heading')}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {t('booking.time.howLongRange', {
          min: formatShortDuration(minMinutes),
          max: formatShortDuration(maxMinutes),
        })}
      </p>

      {day.isLoading && <div className="mt-4 h-64 animate-pulse rounded-xl bg-neutral-100" />}
      {day.isError && (
        <p role="alert" className="mt-4 text-sm text-error-600">
          {t('booking.time.loadError')}
        </p>
      )}
      {noneFree && (
        <div className="mt-4 rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="font-medium text-neutral-900">{t('booking.time.noSlots')}</p>
          <Link
            href={stepPath(pitch.id, 'date')}
            className="mt-2 inline-block text-sm font-medium text-primary-600 hover:underline"
          >
            {t('booking.time.changeDate')}
          </Link>
        </div>
      )}

      {day.isSuccess && !noneFree && (
        <>
          <section aria-labelledby="duration-heading" className="mt-5">
            <h2 id="duration-heading" className="text-base font-semibold text-neutral-900">
              {t('booking.time.howLong')}
            </h2>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {durations.map(d => (
                <button
                  key={d.minutes}
                  type="button"
                  disabled={!d.fits}
                  aria-pressed={minutes === d.minutes}
                  aria-label={`${formatShortDuration(d.minutes)}${d.fits ? '' : t('booking.time.doesntFit')}`}
                  onClick={() => pickLength(d.minutes)}
                  className={chip(minutes === d.minutes)}
                >
                  {formatShortDuration(d.minutes)}
                </button>
              ))}
            </div>
          </section>

          <h2 className="mt-6 text-base font-semibold text-neutral-900">
            {t('booking.time.startHeading')}
          </h2>
          {PERIODS.map(period => {
            const group = starts.filter(s => s.period === period)
            if (!group.length) return null
            return (
              <section key={period} aria-labelledby={`period-${period}`} className="mt-3">
                <h2
                  id={`period-${period}`}
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {t(`dayPeriod.${period}`)}
                </h2>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {group.map(o => (
                    <button
                      key={o.time}
                      type="button"
                      disabled={o.state !== 'available'}
                      aria-pressed={startIndex === o.index}
                      aria-label={`${o.time}, ${t(`booking.time.state.${startIndex === o.index ? 'selected' : o.state}`)}`}
                      onClick={() => setStartTime(o.time)}
                      className={chip(startIndex === o.index)}
                    >
                      {o.time}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}

      <div className="sticky bottom-0 mt-6 space-y-3 bg-neutral-50 py-3">
        <p
          className="rounded-lg bg-white p-3 text-sm text-neutral-700 shadow-sm"
          aria-live="polite"
        >
          {chosen && price ? (
            <>
              <strong className="text-neutral-900">
                {chosen.startTime}–{chosen.endTime}
              </strong>{' '}
              · {formatShortDuration(chosen.minutes)} ·{' '}
              <strong className="text-neutral-900">{price.total} RON</strong>
            </>
          ) : (
            t('booking.time.choosePrompt')
          )}
        </p>
        <Button size="lg" onClick={next} disabled={!chosen}>
          {t('booking.date.next')}
        </Button>
      </div>
    </section>
  )
}
