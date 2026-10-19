'use client'

/**
 * The week calendar — E11-07. Seven day columns, a row per half hour (48 px),
 * each booking a block in its pitch's colour. Bookings that overlap in a day
 * (two pitches at once) sit side by side. The legend hides or shows a
 * pitch's bookings without reloading. A block opens the booking.
 */
import Link from 'next/link'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, List, X } from 'lucide-react'
import {
  DAY_SHORT,
  addDays,
  dayOfWeek,
  fromMinutes,
  toMinutes,
  type CalendarEvent,
  type ManagerCalendar,
} from '@pitchup/shared'

const SLOT_PX = 48
const minutesOf = (t: string) => (t === '24:00' ? 24 * 60 : toMinutes(t))

/**
 * A block's look by status, every one keeping white text readable (the
 * pitch colours are dark enough for it): pending is striped darker, a
 * played game turns grey with its pitch colour down the side, a no-show
 * has a red outline and a cross.
 */
function blockStyle(e: CalendarEvent) {
  if (e.status === 'COMPLETED') {
    return { backgroundColor: '#6B7280', borderLeft: `4px solid ${e.pitchColor}` }
  }
  if (e.status === 'PENDING') {
    return {
      backgroundColor: e.pitchColor,
      backgroundImage:
        'repeating-linear-gradient(45deg, transparent 0 6px, rgba(0,0,0,0.2) 6px 12px)',
    }
  }
  return { backgroundColor: e.pitchColor }
}

/** Side-by-side lanes for bookings that overlap in time. */
function lanes(events: CalendarEvent[]) {
  const sorted = [...events].sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime))
  const ends: number[] = []
  const placed = sorted.map(e => {
    let lane = ends.findIndex(end => end <= minutesOf(e.startTime))
    if (lane < 0) lane = ends.length
    ends[lane] = minutesOf(e.endTime)
    return { e, lane }
  })
  return { placed, count: Math.max(1, ends.length) }
}

const dayLabel = (date: string) => `${DAY_SHORT[dayOfWeek(date)]} ${Number(date.slice(8))}`
const range = (from: string, to: string) => {
  const f = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${f.format(new Date(`${from}T12:00:00Z`))} – ${f.format(new Date(`${to}T12:00:00Z`))} ${to.slice(0, 4)}`
}

export function WeekCalendar({
  calendar: c,
  thisWeek,
  today,
}: {
  calendar: ManagerCalendar
  thisWeek: string
  today: string
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const visible = c.events.filter(e => !hidden.has(e.pitchId))
  const rows = (c.to - c.from) / 30
  const toggle = (id: string) =>
    setHidden(h => {
      const next = new Set(h)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const link = (week: string) => `/manager/bookings/calendar?week=${week}`

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={link(addDays(c.weekStart, -7))}
          aria-label="Previous week"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-white hover:bg-neutral-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href={link(addDays(c.weekStart, 7))}
          aria-label="Next week"
          className="flex h-10 w-10 items-center justify-center rounded-md border border-neutral-200 bg-white hover:bg-neutral-50"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <h2 className="mx-2 text-lg font-semibold text-neutral-900" aria-live="polite">
          {range(c.days[0]!, c.days[6]!)}
        </h2>
        {c.weekStart !== thisWeek && (
          <Link
            href={link(thisWeek)}
            className="h-10 rounded-md border border-neutral-200 bg-white px-4 text-sm font-semibold leading-10 text-neutral-900 hover:bg-neutral-50"
          >
            Today
          </Link>
        )}
        <Link
          href="/manager/bookings"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          <List className="h-4 w-4" aria-hidden="true" />
          List view
        </Link>
      </div>

      {c.pitches.length > 0 && (
        <ul aria-label="Pitches" className="mb-4 flex flex-wrap gap-2">
          {c.pitches.map(p => (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={!hidden.has(p.id)}
                onClick={() => toggle(p.id)}
                className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm ${
                  hidden.has(p.id)
                    ? 'border-neutral-200 text-neutral-500 line-through'
                    : 'border-neutral-300 bg-white text-neutral-900'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  style={{ background: p.color }}
                />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {visible.length === 0 && (
        <p className="mb-3 text-sm text-neutral-500">No bookings this week.</p>
      )}

      <div className="relative overflow-x-auto rounded-xl bg-white shadow-sm">
        <div className="grid min-w-[760px]" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div className="border-b border-neutral-100" />
          {c.days.map(d => (
            <div
              key={d}
              className={`border-b border-l border-neutral-100 py-2 text-center text-sm font-medium ${
                d === today ? 'text-primary-700' : 'text-neutral-700'
              }`}
            >
              {dayLabel(d)}
            </div>
          ))}

          <div className="relative" style={{ height: rows * SLOT_PX }}>
            {Array.from({ length: rows / 2 }, (_, i) => (
              <span
                key={i}
                className="absolute right-2 -translate-y-1/2 text-xs text-neutral-500"
                style={{ top: i * 2 * SLOT_PX }}
              >
                {i === 0 ? '' : fromMinutes(c.from + i * 60)}
              </span>
            ))}
          </div>
          {c.days.map(d => {
            const { placed, count } = lanes(visible.filter(e => e.date === d))
            return (
              <div
                key={d}
                className="relative border-l border-neutral-100"
                style={{
                  height: rows * SLOT_PX,
                  backgroundImage: `repeating-linear-gradient(to bottom, #F5F5F5 0, #F5F5F5 1px, transparent 1px, transparent ${SLOT_PX * 2}px)`,
                }}
              >
                {placed.map(({ e, lane }) => {
                  const top = ((minutesOf(e.startTime) - c.from) / 30) * SLOT_PX
                  const height =
                    Math.max(1, (minutesOf(e.endTime) - minutesOf(e.startTime)) / 30) * SLOT_PX - 2
                  return (
                    <Link
                      key={e.id}
                      href={`/manager/bookings/${e.id}`}
                      aria-label={`${e.playerName}, ${e.pitchName}, ${dayLabel(e.date)} ${e.startTime}–${e.endTime}, ${e.status.toLowerCase().replace('_', '-')}`}
                      className={`absolute overflow-hidden rounded-md p-1.5 text-left text-xs text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 ${
                        e.status === 'NO_SHOW'
                          ? 'outline outline-2 -outline-offset-2 outline-white ring-2 ring-error-600'
                          : ''
                      }`}
                      style={{
                        top,
                        height,
                        left: `calc(${(lane / count) * 100}% + 2px)`,
                        width: `calc(${100 / count}% - 4px)`,
                        ...blockStyle(e),
                      }}
                    >
                      {e.status === 'NO_SHOW' && (
                        <X className="absolute right-1 top-1 h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span className="block truncate font-semibold">{e.playerName}</span>
                      <span className="block truncate">
                        {e.startTime}–{e.endTime}
                      </span>
                      <span className="block truncate">{e.pitchName}</span>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
