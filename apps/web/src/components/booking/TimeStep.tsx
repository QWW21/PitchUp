'use client'

/**
 * Step 2: the time — C-6 (replacing E05-10's grid). Choose a start time,
 * grouped into morning, afternoon and evening, then how long. Which starts
 * and durations are possible comes from @pitchup/shared (startOptions,
 * durationOptions), the same rules as the app.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  bookingPrice,
  durationOptions,
  formatShortDuration,
  keepDuration,
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
  const [start, setStart] = useState<number | null>(null)
  const [minutes, setMinutes] = useState<number | null>(null)

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
  const starts = startOptions(slots, minMinutes)
  const durations = start === null ? [] : durationOptions(slots, start, minMinutes, maxMinutes)

  // Restores a time chosen earlier, if it is still free.
  useEffect(() => {
    if (!slots.length || !draft.startTime || !draft.minutes || start !== null) return
    const i = slots.findIndex(s => s.time === draft.startTime)
    if (i < 0) return
    const fits = durationOptions(slots, i, minMinutes, maxMinutes).some(
      d => d.minutes === draft.minutes && d.fits
    )
    if (fits) {
      setStart(i)
      setMinutes(draft.minutes)
    }
  }, [slots, draft.startTime, draft.minutes, start, minMinutes, maxMinutes])

  const pickStart = (i: number) => {
    setStart(i)
    setMinutes(m => keepDuration(durationOptions(slots, i, minMinutes, maxMinutes), m))
  }

  const chosen =
    start !== null && minutes !== null ? rangeTimes(slots, rangeFrom(start, minutes)) : null
  const price = chosen ? bookingPrice(pitch.hourlyRate, chosen.minutes) : null

  const next = () => {
    if (!chosen) return
    update({ startTime: chosen.startTime, endTime: chosen.endTime, minutes: chosen.minutes })
    router.push(stepPath(pitch.id, 'teams'))
  }

  if (!draft.date) return null
  const noneFree = day.isSuccess && !starts.some(s => s.state === 'available')

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
          {PERIODS.map(period => {
            const group = starts.filter(s => s.period === period)
            if (!group.length) return null
            return (
              <section key={period} aria-labelledby={`period-${period}`} className="mt-5">
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
                      aria-pressed={start === o.index}
                      aria-label={`${o.time}, ${t(`booking.time.state.${start === o.index ? 'selected' : o.state}`)}`}
                      onClick={() => pickStart(o.index)}
                      className={chip(start === o.index)}
                    >
                      {o.time}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}

          <section aria-labelledby="duration-heading" className="mt-6">
            <h2 id="duration-heading" className="text-base font-semibold text-neutral-900">
              {t('booking.time.howLong')}
            </h2>
            {start === null ? (
              <p className="mt-2 text-sm text-neutral-500">{t('booking.time.startFirst')}</p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {durations.map(d => (
                  <button
                    key={d.minutes}
                    type="button"
                    disabled={!d.fits}
                    aria-pressed={minutes === d.minutes}
                    aria-label={`${formatShortDuration(d.minutes)}${d.fits ? '' : t('booking.time.doesntFit')}`}
                    onClick={() => setMinutes(d.minutes)}
                    className={chip(minutes === d.minutes)}
                  >
                    {formatShortDuration(d.minutes)}
                  </button>
                ))}
              </div>
            )}
          </section>
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
