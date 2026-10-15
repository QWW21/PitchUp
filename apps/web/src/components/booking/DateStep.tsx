'use client'

/**
 * Step 1: the date — E05-10 (UIUX_SPEC §7.1, adapted for the web). A month
 * grid, Monday first. Past, closed and out-of-range days are disabled; a
 * fully booked day can be chosen only to be told so. Arrow keys move between
 * days, Enter or Space picks one.
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, dayOfWeek, venueClock, type CalendarDay } from '@pitchup/shared'
import { Button } from '@/components/ui/Button'
import { stepPath, useBooking } from './draft'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const monthStart = (date: string) => `${date.slice(0, 7)}-01`
const daysIn = (first: string) => {
  const [y, m] = first.split('-').map(Number)
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate()
}
const shiftMonth = (first: string, by: number) => {
  const [y, m] = first.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1 + by, 1)).toISOString().slice(0, 10)
}
const longDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))

async function fetchCalendar(pitchId: string, from: string, days: number) {
  const res = await fetch(`/api/v1/pitches/${pitchId}/calendar?from=${from}&days=${days}`, {
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data) throw new Error(body?.error?.message ?? 'Request failed')
  return body.data as CalendarDay[]
}

export function DateStep() {
  const { pitch, draft, ready, update } = useBooking()
  const router = useRouter()
  const prefill = useSearchParams().get('date')
  const today = venueClock(new Date()).date
  const lastDay = addDays(today, pitch.advanceBookingDays)

  const [selected, setSelected] = useState<string | null>(null)
  const [month, setMonth] = useState(monthStart(today))
  const [focused, setFocused] = useState<string>(today)
  const [notice, setNotice] = useState<string | null>(null)
  const grid = useRef<HTMLTableElement>(null)

  // A date from the pitch page's availability strip, or the draft's.
  useEffect(() => {
    const initial = prefill ?? draft.date ?? null
    if (initial && initial >= today && initial <= lastDay) {
      setSelected(initial)
      setMonth(monthStart(initial))
      setFocused(initial)
    }
    // Only on arrival.
  }, [prefill, draft.date])

  const length = daysIn(month)
  const calendar = useQuery({
    queryKey: ['pitch-calendar', pitch.id, month],
    queryFn: () => fetchCalendar(pitch.id, month, length),
    staleTime: 30 * 1000,
  })
  const status = useMemo(
    () => new Map((calendar.data ?? []).map(d => [d.date, d.status])),
    [calendar.data]
  )

  const dates = Array.from({ length }, (_, i) => addDays(month, i))
  const lead = (dayOfWeek(month) + 6) % 7 // Monday-first offset
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...dates]
  while (cells.length % 7) cells.push(null)
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))

  const canPrev = month > monthStart(today)
  const canNext = shiftMonth(month, 1) <= lastDay

  const choose = (date: string) => {
    const s = status.get(date)
    if (s === 'full') {
      setNotice('No available slots on this day.')
      return
    }
    if (s !== 'available') return
    setNotice(null)
    setSelected(date)
    setFocused(date)
  }

  // Keeps keyboard focus on the day the arrows moved to.
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus({
      preventScroll: true,
    })
    // Only when the arrows move it, not on every render.
  }, [focused, month])

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = addDays(focused, step)
    if (next < today || next > lastDay) return
    if (monthStart(next) !== month) setMonth(monthStart(next))
    setFocused(next)
  }

  const next = () => {
    if (!selected) return
    // A new date invalidates the time chosen for the old one.
    update(
      selected === draft.date
        ? {}
        : { date: selected, startTime: undefined, endTime: undefined, minutes: undefined }
    )
    router.push(stepPath(pitch.id, 'time'))
  }

  // Rendered in the browser only, once the draft has been read: a server copy
  // would be replaced straight away, and streaming it briefly showed the
  // calendar twice.
  if (!ready) return <div className="h-96 animate-pulse rounded-xl bg-neutral-100" />

  return (
    <section aria-labelledby="date-heading">
      <h1 id="date-heading" className="text-xl font-semibold text-neutral-900">
        Pick a date
      </h1>

      <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={!canPrev}
            aria-label="Previous month"
            className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h2 className="text-base font-semibold text-neutral-900" aria-live="polite">
            {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
          </h2>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={!canNext}
            aria-label="Next month"
            className="flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <table
          ref={grid}
          role="grid"
          aria-label="Choose a date"
          onKeyDown={onKeyDown}
          className="mt-3 w-full table-fixed border-collapse"
        >
          <thead>
            <tr>
              {WEEKDAYS.map(d => (
                <th key={d} scope="col" className="pb-2 text-xs font-medium text-neutral-500">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, w) => (
              <tr key={w}>
                {week.map((date, i) => {
                  if (!date) return <td key={i} role="gridcell" />
                  const s = status.get(date)
                  const isSelected = date === selected
                  const isToday = date === today
                  const disabled = !calendar.data || s === 'closed' || !s
                  const label = `${longDate(date)}${
                    s === 'full' ? ', fully booked' : s === 'closed' ? ', unavailable' : ''
                  }`
                  return (
                    <td
                      key={date}
                      role="gridcell"
                      aria-selected={isSelected}
                      className="p-0.5 text-center"
                    >
                      <button
                        type="button"
                        data-date={date}
                        tabIndex={date === focused ? 0 : -1}
                        aria-label={label}
                        aria-disabled={disabled || undefined}
                        onClick={() => !disabled && choose(date)}
                        className={`relative mx-auto flex h-11 w-11 items-center justify-center rounded-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
                          isSelected
                            ? 'bg-primary-600 font-semibold text-white'
                            : s === 'available'
                              ? 'text-neutral-900 hover:bg-primary-50'
                              : 'cursor-default text-neutral-500 line-through decoration-neutral-300'
                        } ${s === 'full' && !isSelected ? 'cursor-pointer' : ''}`}
                      >
                        {Number(date.slice(8))}
                        {isToday && !isSelected && (
                          <span
                            className="absolute bottom-1 h-1 w-1 rounded-full bg-primary-600"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <p role="status" className="mt-2 min-h-5 text-center text-sm text-neutral-700">
          {calendar.isError ? 'Couldn’t load the calendar. Try again.' : notice}
        </p>
        <p className="mt-1 text-center text-xs text-neutral-500">
          Crossed-out days are closed, fully booked or out of range.
        </p>
      </div>

      <div className="mt-6">
        <Button size="lg" onClick={next} disabled={!selected}>
          {selected ? `Next: times on ${longDate(selected)}` : 'Next'}
        </Button>
      </div>
    </section>
  )
}
