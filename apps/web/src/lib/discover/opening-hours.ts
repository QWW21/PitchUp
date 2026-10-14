/**
 * Is a venue open at a given instant — E03-01.
 *
 * Working hours are stored as the venue's local wall clock (WorkingHoursSchema),
 * so the instant is converted to Europe/Bucharest first. Doing this on the
 * server's own clock would be off by two or three hours wherever it runs in UTC.
 */
import { DISCOVER, WorkingHoursSchema } from '@pitchup/shared'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const localClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISCOVER.TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Day of week (0 = Sunday) and minutes since midnight, in venue time. */
function venueNow(instant: Date): { day: number; minutes: number } {
  const parts = Object.fromEntries(localClock.formatToParts(instant).map(p => [p.type, p.value]))
  return {
    day: WEEKDAYS.indexOf(parts.weekday ?? ''),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * A close time at or before the open time means the venue closes after
 * midnight ("18:00"–"02:00", or "00:00"–"00:00" for round the clock), so the
 * previous day's entry can still be the one that makes it open now.
 *
 * Missing or malformed hours count as closed: "open now" is a promise to the
 * player, and an unknown schedule cannot keep it.
 */
export function isOpenAt(workingHours: unknown, instant: Date): boolean {
  const parsed = WorkingHoursSchema.safeParse(workingHours)
  if (!parsed.success) return false

  const { day, minutes } = venueNow(instant)
  const yesterday = (day + 6) % 7

  return parsed.data.some(entry => {
    if (entry.isClosed) return false
    const open = toMinutes(entry.openTime)
    const close = toMinutes(entry.closeTime)
    const overnight = close <= open

    if (entry.day === day) return minutes >= open && (overnight || minutes < close)
    if (entry.day === yesterday && overnight) return minutes < close
    return false
  })
}
