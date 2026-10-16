/**
 * Venue time — E03, E04.
 *
 * Working hours are the venue's local wall clock (Europe/Bucharest), so every
 * question about "now", "today" or "the 18:00 slot" has to be asked in that
 * zone. Doing it in the server's or the phone's own zone is off by hours.
 */
import { DISCOVER } from './constants/discover'
import { WorkingHoursSchema } from './schemas/company'

/** One day of the week, always present: closed days have `isClosed: true`. */
export interface DayHours {
  /** 0 = Sunday … 6 = Saturday. */
  day: number
  openTime: string
  closeTime: string
  isClosed: boolean
}

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export const fromMinutes = (minutes: number): string =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * Stored hours (possibly partial, possibly malformed) as exactly seven days,
 * Sunday first. A day with no entry, or unreadable hours, is closed.
 */
export function normalizeWeek(workingHours: unknown): DayHours[] {
  const parsed = WorkingHoursSchema.safeParse(workingHours)
  const entries = parsed.success ? parsed.data : []
  return DAY_SHORT.map((_, day) => {
    const entry = entries.find(e => e.day === day)
    return entry
      ? { day, openTime: entry.openTime, closeTime: entry.closeTime, isClosed: entry.isClosed }
      : { day, openTime: '00:00', closeTime: '00:00', isClosed: true }
  })
}

/** A close time at or before the open time means closing after midnight. */
export const isOvernight = (d: DayHours): boolean => toMinutes(d.closeTime) <= toMinutes(d.openTime)

// ── The venue's clock ───────────────────────────────────────────────────────

const zoneParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISCOVER.TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

interface VenueClock {
  /** YYYY-MM-DD in venue time. */
  date: string
  /** 0 = Sunday. */
  day: number
  /** Minutes since local midnight. */
  minutes: number
}

export function venueClock(instant: Date): VenueClock {
  const ms = instant.getTime()
  // Shift by the venue's offset and read the result as if it were UTC.
  const local = new Date(ms + zoneOffsetMs(ms))
  return {
    date: local.toISOString().slice(0, 10),
    day: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  }
}

const HOUR = 3_600_000
/**
 * Offset per UTC hour. Asking Intl is slow (a calendar of 31 days asks
 * thousands of times), and the venue's offset only changes on the hour
 * (Europe/Bucharest switches at 01:00 UTC), so one answer per hour is exact.
 */
const offsetByHour = new Map<number, number>()

/** Offset of venue time from UTC at an instant, in ms (+3h in summer → 10_800_000). */
function zoneOffsetMs(utcMs: number): number {
  const hour = Math.floor(utcMs / HOUR)
  const cached = offsetByHour.get(hour)
  if (cached !== undefined) return cached
  const at = hour * HOUR
  const p = Object.fromEntries(zoneParts.formatToParts(new Date(at)).map(x => [x.type, x.value]))
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    // en-GB with h23 never says 24, but guard anyway: midnight is hour 0.
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second)
  )
  const offset = asUtc - at
  // A long-running server sees new hours forever; keep the map small.
  if (offsetByHour.size > 50_000) offsetByHour.clear()
  offsetByHour.set(hour, offset)
  return offset
}

/**
 * The instant at which the venue's wall clock reads `minutes` past midnight
 * on `date`. Checked twice so a DST change on that day lands on the right side.
 */
export function venueTimeToUtc(date: string, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y!, m! - 1, d!, 0, minutes)
  const first = guess - zoneOffsetMs(guess)
  return new Date(guess - zoneOffsetMs(first))
}

/** Calendar arithmetic on YYYY-MM-DD, independent of any zone. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}

/** Day of week of a YYYY-MM-DD date (0 = Sunday). */
export const dayOfWeek = (date: string): number => new Date(`${date}T12:00:00Z`).getUTCDay()

// ── Questions about a week of hours ─────────────────────────────────────────

/**
 * Open at an instant? The previous day's entry counts when it runs past
 * midnight. Missing or malformed hours count as closed: "open now" is a
 * promise to the player, and an unknown schedule cannot keep it.
 */
export function isOpenAt(workingHours: unknown, instant: Date): boolean {
  const week = normalizeWeek(workingHours)
  const { day, minutes } = venueClock(instant)
  const today = week[day]!
  const yesterday = week[(day + 6) % 7]!

  if (!today.isClosed && minutes >= toMinutes(today.openTime)) {
    if (isOvernight(today) || minutes < toMinutes(today.closeTime)) return true
  }
  return !yesterday.isClosed && isOvernight(yesterday) && minutes < toMinutes(yesterday.closeTime)
}

/**
 * Opening intervals that fall on a calendar date, in minutes since that
 * date's midnight. A date can have two: the tail of the previous evening's
 * overnight hours (00:00–02:00) and its own hours. Bookings never span
 * midnight (BOOKING.ALLOW_SPANNING_MIDNIGHT), so its own interval stops at 24:00.
 */
export function openIntervalsOn(week: DayHours[], date: string): [number, number][] {
  const day = dayOfWeek(date)
  const today = week[day]!
  const yesterday = week[(day + 6) % 7]!
  const intervals: [number, number][] = []

  if (!yesterday.isClosed && isOvernight(yesterday) && toMinutes(yesterday.closeTime) > 0) {
    intervals.push([0, toMinutes(yesterday.closeTime)])
  }
  if (!today.isClosed) {
    const open = toMinutes(today.openTime)
    intervals.push([open, isOvernight(today) ? 24 * 60 : toMinutes(today.closeTime)])
  }
  return intervals
}

export type TodayStatus =
  | { kind: 'open'; closesAt: string }
  | { kind: 'opensLater'; opensAt: string }
  | { kind: 'closedToday' }

/** The one-line summary under a venue's name: "Open · Closes at 23:00". UIUX_SPEC §6.1. */
export function todayStatus(workingHours: unknown, now: Date): TodayStatus {
  const week = normalizeWeek(workingHours)
  const { day, minutes } = venueClock(now)
  const today = week[day]!
  const yesterday = week[(day + 6) % 7]!

  if (!yesterday.isClosed && isOvernight(yesterday) && minutes < toMinutes(yesterday.closeTime)) {
    return { kind: 'open', closesAt: yesterday.closeTime }
  }
  if (today.isClosed) return { kind: 'closedToday' }
  if (minutes < toMinutes(today.openTime)) return { kind: 'opensLater', opensAt: today.openTime }
  if (isOvernight(today) || minutes < toMinutes(today.closeTime)) {
    return { kind: 'open', closesAt: today.closeTime }
  }
  return { kind: 'closedToday' }
}

/** "08:00 – 23:00", "Open 24 hours" or "Closed". */
export function formatDayHours(d: DayHours): string {
  if (d.isClosed) return 'Closed'
  if (d.openTime === d.closeTime) return 'Open 24 hours'
  return `${d.openTime} – ${d.closeTime}`
}
