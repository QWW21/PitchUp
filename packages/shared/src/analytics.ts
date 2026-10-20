/**
 * A venue's analytics — E14. The periods, the buckets, what a booking earns
 * the venue, and the shapes the dashboard reads. Pure: dates are the venue's
 * calendar days ("YYYY-MM-DD", Europe/Bucharest), as everywhere else.
 *
 * Revenue (decided with the owner, 2026-10-17) is what the venue earned:
 * the full price of games that were played, whether paid online or at the
 * venue, plus whatever it kept when a booking was cancelled late or the
 * player didn't come; less anything refunded.
 */
import { z } from 'zod'
import { PLATFORM_FEE_PERCENT } from './constants/penalties'
import { addDays, dayOfWeek } from './schedule'
import type { BookingStatus } from './types'
import { sharedT } from './i18n'
import type { Locale } from './i18n/core'

export const ANALYTICS_PERIODS = ['7d', '30d', '90d', '12m'] as const
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]
export type AnalyticsGroupBy = 'day' | 'week' | 'month'

/** "Last 30 days", by `analyticsPeriod.<period>`. */
export const analyticsPeriodLabel = (period: AnalyticsPeriod, locale: Locale): string =>
  sharedT(locale)(`analyticsPeriod.${period}`)

/** ?period=30d&pitchId=… — a pitch of another venue simply matches nothing. */
export const AnalyticsQuerySchema = z.object({
  period: z.enum(ANALYTICS_PERIODS).default('30d'),
  pitchId: z.string().min(1).max(40).optional(),
})
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>

export interface AnalyticsRange {
  /** First and last venue day, both included; the last is today. */
  from: string
  to: string
  groupBy: AnalyticsGroupBy
  /** The same length just before, for the "vs previous period" figures. */
  priorFrom: string
  priorTo: string
}

const DAYS: Record<Exclude<AnalyticsPeriod, '12m'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** Twelve months: from the first of the month eleven months ago, to today. */
const monthStart = (date: string, monthsBack: number) => {
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7)) - 1 - monthsBack
  const d = new Date(Date.UTC(y, m, 1))
  return d.toISOString().slice(0, 10)
}

export function analyticsRange(period: AnalyticsPeriod, today: string): AnalyticsRange {
  if (period === '12m') {
    const from = monthStart(today, 11)
    return {
      from,
      to: today,
      groupBy: 'month',
      priorFrom: monthStart(today, 23),
      priorTo: addDays(from, -1),
    }
  }
  const n = DAYS[period]
  const from = addDays(today, -(n - 1))
  return {
    from,
    to: today,
    groupBy: period === '90d' ? 'week' : 'day',
    priorFrom: addDays(from, -n),
    priorTo: addDays(from, -1),
  }
}

/** The bucket a day falls in: the day, its Monday, or the first of its month. */
export function bucketOf(date: string, groupBy: AnalyticsGroupBy): string {
  if (groupBy === 'day') return date
  if (groupBy === 'week') return addDays(date, -((dayOfWeek(date) + 6) % 7))
  return `${date.slice(0, 7)}-01`
}

/** Every bucket from `from` to `to`, so the chart has no gaps. */
export function bucketsBetween(from: string, to: string, groupBy: AnalyticsGroupBy): string[] {
  const keys: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const key = bucketOf(d, groupBy)
    if (keys.at(-1) !== key) keys.push(key)
  }
  return keys
}

/** "4 Nov" for a day or a week (its Monday), "Nov 2026" for a month. */
export function bucketLabel(key: string, groupBy: AnalyticsGroupBy, locale: Locale): string {
  const t = sharedT(locale)
  const month = t(`month.short.${Number(key.slice(5, 7))}` as 'month.short.1')
  return groupBy === 'month'
    ? t('date.monthYear', { month, year: key.slice(0, 4) })
    : t('date.dayMonth', { day: Number(key.slice(8)), month })
}

// ── What a booking earned ───────────────────────────────────────────────────

export interface RevenueBooking {
  status: BookingStatus
  /** The game has started (a CONFIRMED one is played once it has). */
  started: boolean
  total: number
  paymentMethod: string
  deposit: number | null
  dueAtVenue: number
  paid: boolean
  refunded: number | null
}

export interface Earned {
  gross: number
  online: number
  atVenue: number
  /** The game took place (or the player didn't come): it counts as a booking. */
  counted: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * - Played (COMPLETED, or CONFIRMED and started): the full price; what was
 *   due at the venue is "at venue", the rest "online".
 * - A no-show, or a paid booking cancelled: what was paid online and not
 *   refunded.
 * - Anything else (unpaid, waiting, upcoming): nothing yet.
 */
export function bookingEarned(b: RevenueBooking): Earned {
  if (b.status === 'COMPLETED' || (b.status === 'CONFIRMED' && b.started)) {
    const atVenue = Math.min(b.dueAtVenue, b.total)
    return { gross: b.total, online: round2(b.total - atVenue), atVenue, counted: true }
  }
  if (b.status === 'NO_SHOW' || (b.status === 'CANCELLED' && b.paid)) {
    const charged = b.paymentMethod === 'ONLINE' ? b.total : (b.deposit ?? 0)
    const kept = round2(Math.max(0, charged - (b.refunded ?? 0)))
    return { gross: kept, online: kept, atVenue: 0, counted: b.status === 'NO_SHOW' }
  }
  return { gross: 0, online: 0, atVenue: 0, counted: false }
}

/**
 * PitchUp's commission on what the venue earned, and what the venue keeps.
 * `rate` is the booking's own (its fee over its price), since the admin can
 * change the commission (E15); 8% when unknown.
 */
export function feesOn(
  gross: number,
  rate: number = PLATFORM_FEE_PERCENT / 100
): { fees: number; payout: number } {
  const fees = round2(gross * rate)
  return { fees, payout: round2(gross - fees) }
}

/** A booking's commission rate, from what it stored. */
export const feeRate = (total: number, platformFee: number): number =>
  total > 0 ? platformFee / total : PLATFORM_FEE_PERCENT / 100

/** +12 for 12% more; null when there is nothing to compare with. */
export const percentChange = (now: number | null, before: number | null): number | null =>
  now === null || before === null || before === 0
    ? null
    : Math.round(((now - before) / before) * 100)

// ── The shapes the dashboard reads ──────────────────────────────────────────

export interface RevenuePoint {
  /** The bucket's first day. */
  period: string
  gross: number
  online: number
  atVenue: number
  fees: number
  payout: number
  bookings: number
}

/** GET /manager/analytics/revenue — every bucket of the period, empty ones as 0. */
export interface AnalyticsRevenue {
  period: AnalyticsPeriod
  groupBy: AnalyticsGroupBy
  data: RevenuePoint[]
}

/**
 * GET /manager/analytics/occupancy — grid[day][hour], 0 = Sunday: the share
 * of open time that was booked, 0–100; null where the pitches were never
 * open at that hour.
 */
export interface AnalyticsOccupancy {
  period: AnalyticsPeriod
  grid: (number | null)[][]
}

export interface Kpi {
  value: number | null
  /** % vs the same length before; null with nothing to compare. */
  change: number | null
}

/** GET /manager/analytics/summary */
export interface AnalyticsSummary {
  period: AnalyticsPeriod
  revenue: Kpi & { online: number; atVenue: number }
  bookings: Kpi
  /** % of open time booked. */
  occupancy: Kpi
  /** Reviews written in the period; null without any. */
  avgRating: Kpi
  /** % of bookings that took place where the player didn't come. */
  noShowRate: Kpi
}

/** GET /manager/analytics/pitches — one row per pitch. */
export interface PitchPerformanceRow {
  pitchId: string
  name: string
  isActive: boolean
  revenue: number
  totalBookings: number
  completedBookings: number
  occupancy: number | null
  /** 0–100, of all the period's bookings. */
  cancellationRate: number
  noShowRate: number
  avgRating: number | null
  reviewCount: number
}

export const ANALYTICS_EXPORT_LIMIT = 10_000

/** One CSV field: quoted when it has a comma, quote or line break; formulas defused. */
export function csvField(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value)
  // A cell starting with = + - @ is run as a formula by spreadsheets.
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const csvLine = (fields: (string | number | null | undefined)[]): string =>
  fields.map(csvField).join(',')
