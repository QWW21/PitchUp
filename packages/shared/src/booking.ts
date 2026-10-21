/**
 * Booking rules shared by the API, the web flow and the mobile flow — E05.
 * Pure functions: no I/O, no clock unless one is passed in.
 */
import { BOOKING } from './constants/booking'
import { DEFAULT_REFUND_POLICY, type RefundPolicy } from './constants/cancellation'
import type { PitchSize } from './types'
import type { SlotStatus } from './schemas/detail'
import { fromMinutes, toMinutes } from './schedule'
import { hoursText, sharedT } from './i18n'
import type { Locale } from './i18n/core'

const round2 = (n: number) => Math.round(n * 100) / 100

/** "24:00" for the end of the day rather than fromMinutes' "00:00". */
export const endLabel = (minutes: number): string =>
  minutes === 24 * 60 ? '24:00' : fromMinutes(minutes)

export interface BookingPrice {
  minutes: number
  /** What the player pays, and all of it is the venue's (C-15: no commission). */
  total: number
}

/** Price of a booking. One rate at any time of day (C-2); shirts are free (C-1). */
export function bookingPrice(hourlyRate: number, minutes: number): BookingPrice {
  return { minutes, total: round2((hourlyRate * minutes) / 60) }
}

/** "2h 00min", "1h 30min", "30min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = String(minutes % 60).padStart(2, '0')
  return h ? `${h}h ${m}min` : `${minutes}min`
}

/** Refund for a player who cancels this long before kick-off, under a venue's policy (C-10). */
export function refundPercentFor(
  hoursBeforeStart: number,
  policy: RefundPolicy = DEFAULT_REFUND_POLICY
): number {
  if (hoursBeforeStart >= policy.fullRefundHours) return 100
  if (hoursBeforeStart >= policy.partialRefundHours) return policy.partialRefundPercent
  return 0
}

/** The last moment a cancellation is fully refunded. */
export const freeCancellationUntil = (
  start: Date,
  policy: RefundPolicy = DEFAULT_REFUND_POLICY
): Date => new Date(start.getTime() - policy.fullRefundHours * 3_600_000)

/** The last moment a cancellation is partly refunded. */
export const partialRefundUntil = (
  start: Date,
  policy: RefundPolicy = DEFAULT_REFUND_POLICY
): Date => new Date(start.getTime() - policy.partialRefundHours * 3_600_000)

/**
 * A policy as stored (a venue's columns, or a booking's snapshot), or the
 * default when there is none: bookings made before C-10 have none.
 */
export function refundPolicyOf(stored: unknown): RefundPolicy {
  const p = stored as Partial<RefundPolicy> | null | undefined
  return p &&
    typeof p.fullRefundHours === 'number' &&
    typeof p.partialRefundHours === 'number' &&
    typeof p.partialRefundPercent === 'number'
    ? {
        fullRefundHours: p.fullRefundHours,
        partialRefundHours: p.partialRefundHours,
        partialRefundPercent: p.partialRefundPercent,
      }
    : DEFAULT_REFUND_POLICY
}

/**
 * The policy in one sentence, for the pitch page, the summary and the
 * settings preview: "Free cancellation up to 12 hours before kick-off; 75%
 * back up to 2 hours before; nothing after."
 */
export function describeRefundPolicy(policy: RefundPolicy, locale: Locale): string {
  const t = sharedT(locale)
  const {
    fullRefundHours: full,
    partialRefundHours: partial,
    partialRefundPercent: percent,
  } = policy
  if (full === 0) return t('refundPolicy.untilKickOff')
  const free = t('refundPolicy.free', { hours: hoursText(full, locale) })
  if (percent === 0 || partial >= full) return t('refundPolicy.nothingAfter', { free })
  if (partial === 0) return t('refundPolicy.partialUntilKickOff', { free, percent })
  return t('refundPolicy.partial', { free, percent, hours: hoursText(partial, locale) })
}

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

// ── Choosing a time: how long, then a start (C-6) ────────────────────────────

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

export type DayPeriod = 'Morning' | 'Afternoon' | 'Evening'

/** Morning before 12:00, afternoon 12:00–17:00, evening from 17:00. */
export function dayPeriod(time: string): DayPeriod {
  const m = toMinutes(time)
  return m < 12 * 60 ? 'Morning' : m < 17 * 60 ? 'Afternoon' : 'Evening'
}

/**
 * Minutes free from slot `index`: consecutive available slots with no gap in
 * the opening hours, capped at `maxMinutes`.
 */
function freeMinutesFrom(slots: Slot[], index: number, maxMinutes: number): number {
  let minutes = 0
  for (let i = index; i < slots.length && minutes < maxMinutes; i++) {
    if (slots[i]!.status !== 'available') break
    if (i > index && toMinutes(slots[i]!.time) !== toMinutes(slots[i - 1]!.time) + SLOT) break
    minutes += SLOT
  }
  return minutes
}

export interface StartOption {
  time: string
  /** Index into the day's slots. */
  index: number
  period: DayPeriod
  /** `short`: free, but the shortest booking doesn't fit before the next booking or closing. */
  state: 'available' | 'booked' | 'past' | 'short'
}

/** Every half hour of the day as a possible start. Same rules on web and mobile. */
export function startOptions(slots: Slot[], minMinutes: number): StartOption[] {
  return slots.map((slot, index) => ({
    time: slot.time,
    index,
    period: dayPeriod(slot.time),
    state:
      slot.status !== 'available'
        ? slot.status
        : freeMinutesFrom(slots, index, minMinutes) >= minMinutes
          ? 'available'
          : 'short',
  }))
}

export interface DurationOption {
  minutes: number
  /** Ends before the next booking and closing time. */
  fits: boolean
}

/**
 * The lengths a player can choose first (C-6, length before start): the
 * pitch's minimum to maximum in half hours, each marked whether any start
 * that day still has room for all of it.
 */
export function durationChoices(
  slots: Slot[],
  minMinutes: number,
  maxMinutes: number
): DurationOption[] {
  const longest = slots.reduce(
    (most, _, i) => Math.max(most, freeMinutesFrom(slots, i, maxMinutes)),
    0
  )
  const options: DurationOption[] = []
  for (let m = minMinutes; m <= maxMinutes; m += SLOT)
    options.push({ minutes: m, fits: m <= longest })
  return options
}

/** "1h", "1h 30", "30 min": the duration chips. */
export function formatShortDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h}h ${m}` : `${h}h`
}

/** A start and a duration as a range of slots. */
export const rangeFrom = (index: number, minutes: number): SlotRange => ({
  start: index,
  end: index + minutes / SLOT - 1,
})

/** The selection as venue wall-clock times, e.g. { startTime: "18:00", endTime: "20:00" }. */
export function rangeTimes(slots: Slot[], range: SlotRange) {
  const startTime = slots[range.start]!.time
  const endMinutes = toMinutes(slots[range.end]!.time) + SLOT
  return { startTime, endTime: endLabel(endMinutes), minutes: (range.end - range.start + 1) * SLOT }
}

// formatMonth and formatDateLong moved to ./i18n, which names the months.

/**
 * What cancelling now would refund: the booking's policy applied to what was
 * paid. The player pays only the pitch price (E05), so all of it is refundable.
 */
export function cancellationRefund(
  total: number,
  start: Date,
  now: Date = new Date(),
  policy: RefundPolicy = DEFAULT_REFUND_POLICY
) {
  const percent = refundPercentFor((start.getTime() - now.getTime()) / 3_600_000, policy)
  return { percent, amount: Math.floor(((total * percent) / 100) * 100) / 100 }
}

/** "3h 20min", "45min", or "Starting now". The upcoming card's countdown (E06-06). */
export function formatCountdown(start: Date, locale: Locale, now: Date = new Date()): string {
  const t = sharedT(locale)
  const diff = start.getTime() - now.getTime()
  if (diff <= 0) return t('duration.countdownNow')
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? t('duration.hoursMinutes', { h, m }) : t('duration.minutes', { m })
}
