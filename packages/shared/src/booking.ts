/**
 * Booking rules shared by the API, the web flow and the mobile flow — E05.
 * Pure functions: no I/O, no clock unless one is passed in.
 */
import { BOOKING } from './constants/booking'
import { CANCELLATION_WINDOWS, REFUND_PERCENTAGES } from './constants/cancellation'
import { PLATFORM_FEE_PERCENT } from './constants/penalties'
import type { PitchSize } from './types'
import type { SlotStatus } from './schemas/detail'
import { fromMinutes, toMinutes } from './schedule'

const round2 = (n: number) => Math.round(n * 100) / 100

/** "24:00" for the end of the day rather than fromMinutes' "00:00". */
export const endLabel = (minutes: number): string =>
  minutes === 24 * 60 ? '24:00' : fromMinutes(minutes)

export interface BookingPrice {
  minutes: number
  /** What the player pays: hourly rate × hours. */
  total: number
  /**
   * PitchUp's commission, kept from the venue's payout; the player does not
   * pay it on top. PRD §8: 8% of booking value.
   */
  platformFee: number
  /** What the venue receives. */
  venuePayout: number
}

/** Price of a booking. One rate at any time of day (C-2); shirts are free (C-1). */
export function bookingPrice(hourlyRate: number, minutes: number): BookingPrice {
  const total = round2((hourlyRate * minutes) / 60)
  const platformFee = round2((total * PLATFORM_FEE_PERCENT) / 100)
  return { minutes, total, platformFee, venuePayout: round2(total - platformFee) }
}

/** "2h 00min", "1h 30min", "30min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = String(minutes % 60).padStart(2, '0')
  return h ? `${h}h ${m}min` : `${minutes}min`
}

/** Refund for a player who cancels this long before kick-off. PRD §9.2. */
export function refundPercentFor(hoursBeforeStart: number): number {
  if (hoursBeforeStart >= CANCELLATION_WINDOWS.FULL_REFUND_HOURS) return REFUND_PERCENTAGES.FULL
  if (hoursBeforeStart >= CANCELLATION_WINDOWS.PARTIAL_REFUND_HOURS) {
    return REFUND_PERCENTAGES.PARTIAL
  }
  return REFUND_PERCENTAGES.NONE
}

/** The last moment a cancellation is fully refunded. */
export const freeCancellationUntil = (start: Date): Date =>
  new Date(start.getTime() - CANCELLATION_WINDOWS.FULL_REFUND_HOURS * 3_600_000)

/** "#AB12CD": a short reference a player can read out over the phone. */
export const bookingReference = (id: string): string => `#${id.slice(-6).toUpperCase()}`

/** Players per team the size suggests; the default on the teams step (C-3). */
export const PLAYERS_FOR_SIZE: Record<PitchSize, number> = {
  FIVE_A_SIDE: 5,
  SIX_A_SIDE: 6,
  SEVEN_A_SIDE: 7,
  ELEVEN_A_SIDE: 11,
  CUSTOM: 6,
}

// ── Choosing a time range on the slot grid ──────────────────────────────────

export interface SlotRange {
  /** Indexes into the day's slots, inclusive. */
  start: number
  end: number
}

interface Slot {
  time: string
  status: SlotStatus
}

const SLOT = BOOKING.SLOT_MINUTES

/**
 * What a tap on slot `index` does to the current selection. Same rules on web
 * and mobile (E05-03):
 *
 * - nothing selected → the tapped slot starts a selection;
 * - tapping the start again → clears it;
 * - tapping above the start → starts over from there;
 * - tapping below → extends to it, stopping before the first slot that is
 *   not free (booked, past, or a gap in the opening hours) and at the
 *   longest booking allowed.
 */
export function tapSlot(
  slots: Slot[],
  selection: SlotRange | null,
  index: number,
  maxMinutes: number
): SlotRange | null {
  if (slots[index]?.status !== 'available') return selection
  if (!selection) return { start: index, end: index }
  if (index === selection.start) return null
  if (index < selection.start) return { start: index, end: index }

  const maxSlots = Math.floor(maxMinutes / SLOT)
  let end = selection.start
  for (let i = selection.start + 1; i <= index && i - selection.start < maxSlots; i++) {
    const contiguous = toMinutes(slots[i]!.time) === toMinutes(slots[i - 1]!.time) + SLOT
    if (slots[i]!.status !== 'available' || !contiguous) break
    end = i
  }
  return { start: selection.start, end }
}

/** The selection as venue wall-clock times, e.g. { startTime: "18:00", endTime: "20:00" }. */
export function rangeTimes(slots: Slot[], range: SlotRange) {
  const startTime = slots[range.start]!.time
  const endMinutes = toMinutes(slots[range.end]!.time) + SLOT
  return { startTime, endTime: endLabel(endMinutes), minutes: (range.end - range.start + 1) * SLOT }
}

const MONTH_NAMES = [
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
] as const

/** "October 2026", from any YYYY-MM-DD in that month. */
export const formatMonth = (date: string): string =>
  `${MONTH_NAMES[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`

/**
 * "Thursday, 5 November 2026". Done by hand rather than with Intl, whose
 * support on React Native (Hermes) varies by platform and version.
 */
export function formatDateLong(date: string): string {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return `${weekdays[day]}, ${Number(date.slice(8))} ${MONTH_NAMES[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
}

/**
 * What cancelling now would refund: PRD §9.2 applied to what was paid.
 * The player pays only the pitch price (E05), so all of it is refundable.
 */
export function cancellationRefund(total: number, start: Date, now: Date = new Date()) {
  const percent = refundPercentFor((start.getTime() - now.getTime()) / 3_600_000)
  return { percent, amount: Math.floor(((total * percent) / 100) * 100) / 100 }
}

/** "3h 20min", "45min", or "Starting now". The upcoming card's countdown (E06-06). */
export function formatCountdown(start: Date, now: Date = new Date()): string {
  const diff = start.getTime() - now.getTime()
  if (diff <= 0) return 'Starting now'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}
