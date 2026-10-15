'use client'

/**
 * Step 2: the time — E05-10 (UIUX_SPEC §7.2). One row per 30 minutes; click
 * a start, then an end. The rules for what a click does are shared with the
 * app (tapSlot in @pitchup/shared): a range stops before a booked slot, a gap
 * in the hours, or the longest booking allowed.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  bookingPrice,
  formatDuration,
  rangeTimes,
  tapSlot,
  toMinutes,
  type PitchAvailability,
  type SlotRange,
} from '@pitchup/shared'
import { Button } from '@/components/ui/Button'
import { stepPath, useBooking } from './draft'

async function fetchDay(pitchId: string, date: string) {
  // Never cached: a slot booked a moment ago must show as booked.
  const res = await fetch(`/api/v1/pitches/${pitchId}/availability?date=${date}`, {
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? 'Request failed')
  return body.data as PitchAvailability
}

export function TimeStep() {
  const { pitch, draft, ready, update } = useBooking()
  const router = useRouter()
  const [range, setRange] = useState<SlotRange | null>(null)

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

  // Restores a range chosen earlier, if those slots are still free.
  useEffect(() => {
    if (!slots.length || !draft.startTime || !draft.endTime || range) return
    const start = slots.findIndex(s => s.time === draft.startTime)
    const endMinutes = toMinutes(draft.endTime) - 30
    const end = slots.findIndex(s => toMinutes(s.time) === endMinutes)
    if (
      start >= 0 &&
      end >= start &&
      slots.slice(start, end + 1).every(s => s.status === 'available')
    ) {
      setRange({ start, end })
    }
  }, [slots, draft.startTime, draft.endTime, range])

  const maxMinutes = pitch.maxBookingHours * 60
  const minMinutes = pitch.minBookingHours * 60
  const chosen = range ? rangeTimes(slots, range) : null
  const valid = !!chosen && chosen.minutes >= minMinutes
  const price = chosen ? bookingPrice(pitch.hourlyRate, chosen.minutes) : null

  const next = () => {
    if (!chosen || !valid) return
    update({ startTime: chosen.startTime, endTime: chosen.endTime, minutes: chosen.minutes })
    router.push(stepPath(pitch.id, 'teams'))
  }

  if (!draft.date) return null
  const noneFree = day.isSuccess && !slots.some(s => s.status === 'available')

  return (
    <section aria-labelledby="time-heading">
      <h1 id="time-heading" className="text-xl font-semibold text-neutral-900">
        Pick a time
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Click when you start, then when you finish. {pitch.minBookingHours}–{pitch.maxBookingHours}{' '}
        hours.
      </p>

      <p
        className="mt-4 inline-block rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700"
        aria-live="polite"
      >
        {chosen
          ? `${chosen.startTime}–${chosen.endTime} · ${formatDuration(chosen.minutes)}`
          : 'Select a start and end time'}
      </p>

      {day.isLoading && <div className="mt-4 h-64 animate-pulse rounded-xl bg-neutral-100" />}
      {day.isError && (
        <p role="alert" className="mt-4 text-sm text-error-600">
          Couldn&rsquo;t load the times. Try again.
        </p>
      )}
      {noneFree && (
        <div className="mt-4 rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="font-medium text-neutral-900">No slots available for this date</p>
          <Link
            href={stepPath(pitch.id, 'date')}
            className="mt-2 inline-block text-sm font-medium text-primary-600 hover:underline"
          >
            ← Change date
          </Link>
        </div>
      )}

      {day.isSuccess && !noneFree && (
        <ol aria-label="Times" className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
          {slots.map((slot, i) => {
            const inRange = range && i >= range.start && i <= range.end
            const isStart = range?.start === i
            const isEnd = range?.end === i
            const free = slot.status === 'available'
            return (
              <li key={slot.time} className="flex h-10 border-b border-neutral-100 last:border-0">
                <span className="flex w-14 shrink-0 items-center justify-center text-xs text-neutral-500">
                  {slot.time}
                </span>
                <button
                  type="button"
                  disabled={!free}
                  aria-pressed={!!inRange}
                  aria-label={`${slot.time}, ${free ? (inRange ? 'selected' : 'available') : slot.status === 'past' ? 'already passed' : 'booked'}`}
                  onClick={() => setRange(r => tapSlot(slots, r, i, maxMinutes))}
                  className={`flex flex-1 items-center px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 ${
                    inRange
                      ? isStart || isEnd
                        ? 'bg-primary-600 font-medium text-white'
                        : 'border-l-[3px] border-primary-600 bg-primary-100 text-primary-900'
                      : free
                        ? 'bg-white text-neutral-700 hover:bg-primary-50'
                        : slot.status === 'past'
                          ? 'cursor-not-allowed bg-neutral-50 text-neutral-500'
                          : 'cursor-not-allowed bg-neutral-100 text-neutral-500 line-through'
                  } ${isStart ? 'rounded-t-lg' : ''} ${isEnd ? 'rounded-b-lg' : ''}`}
                >
                  {inRange
                    ? isStart
                      ? 'Start'
                      : isEnd
                        ? 'End'
                        : ''
                    : free
                      ? ''
                      : slot.status === 'past'
                        ? 'Passed'
                        : 'Booked'}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <div className="sticky bottom-0 mt-4 space-y-3 bg-neutral-50 py-3">
        {chosen && price && (
          <p className="rounded-lg bg-white p-3 text-sm text-neutral-700 shadow-sm">
            {formatDuration(chosen.minutes)} × {pitch.hourlyRate} RON/h ={' '}
            <strong className="text-neutral-900">{price.total} RON</strong>
          </p>
        )}
        {chosen && !valid && (
          <p className="text-sm text-neutral-700">
            Choose at least {pitch.minBookingHours} hour{pitch.minBookingHours === 1 ? '' : 's'}.
          </p>
        )}
        <Button size="lg" onClick={next} disabled={!valid}>
          Next
        </Button>
      </div>
    </section>
  )
}
