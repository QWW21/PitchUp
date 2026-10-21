/**
 * A venue's analytics — E14-01 … E14-05.
 *
 * Everything is worked out in the venue's own days and hours (Europe/Bucharest)
 * rather than UTC, so "Tuesday 18:00" on the heatmap is 18:00 on the pitch.
 * One pass over the period's bookings and the pitches' opening hours gives
 * every figure: revenue by bucket, the heatmap, the KPIs and the per-pitch
 * table. The periods end now: today counts up to the current time.
 */
import 'server-only'
import {
  ANALYTICS_EXPORT_LIMIT,
  addDays,
  analyticsRange,
  bookingEarned,
  bookingReference,
  bucketOf,
  bucketsBetween,
  csvLine,
  dayOfWeek,
  endLabel,
  fromMinutes,
  normalizeWeek,
  percentChange,
  venueClock,
  venueTimeToUtc,
  type AnalyticsOccupancy,
  type AnalyticsPeriod,
  type AnalyticsRevenue,
  type AnalyticsSummary,
  type PitchPerformanceRow,
  type RevenuePoint,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { webT } from '@/i18n/catalog'
import { getLocale } from '@/i18n/server'
import { dayIntervals, type PitchSchedule } from '@/lib/venues/availability'

const OCCUPYING = new Set(['CONFIRMED', 'COMPLETED', 'NO_SHOW'])

interface Window {
  from: string
  to: string
}

/** What one pass over a window gives. */
interface Figures {
  buckets: Map<string, RevenuePoint>
  online: number
  atVenue: number
  gross: number
  counted: number
  noShows: number
  open: number
  booked: number
  /** Open and booked minutes, by day of week and hour. */
  gridOpen: number[][]
  gridBooked: number[][]
  pitches: Map<
    string,
    {
      revenue: number
      total: number
      played: number
      cancelled: number
      noShows: number
      open: number
      booked: number
    }
  >
}

const grid = () => Array.from({ length: 7 }, () => new Array<number>(24).fill(0))

/** Adds minutes [from, to) of a venue day to a 7×24 grid, hour by hour. */
function spread(target: number[][], day: number, from: number, to: number) {
  for (let m = from; m < to;) {
    const hour = Math.floor(m / 60)
    const next = Math.min(to, (hour + 1) * 60)
    target[day]![hour]! += next - m
    m = next
  }
}

async function figures(
  companyId: string,
  window: Window,
  groupBy: 'day' | 'week' | 'month',
  pitchId: string | undefined,
  now: Date
): Promise<Figures> {
  const today = venueClock(now).date
  const nowMinutes = venueClock(now).minutes
  const start = venueTimeToUtc(window.from, 0)
  const end = venueTimeToUtc(addDays(window.to, 1), 0)
  const [company, pitches, bookings, exceptions] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { workingHours: true } }),
    prisma.pitch.findMany({
      where: { companyId, deletedAt: null, ...(pitchId ? { id: pitchId } : {}) },
      select: { id: true, isActive: true, workingHours: true },
    }),
    prisma.booking.findMany({
      where: {
        pitch: { companyId },
        ...(pitchId ? { pitchId } : {}),
        startTime: { gte: start, lt: end },
        status: { notIn: ['PENDING', 'AWAITING_APPROVAL'] },
      },
      select: {
        pitchId: true,
        status: true,
        startTime: true,
        endTime: true,
        totalAmount: true,
        paymentMethod: true,
        depositAmount: true,
        dueAtVenue: true,
        paidAt: true,
        refundAmount: true,
      },
    }),
    prisma.pitchException.findMany({
      where: {
        pitch: { companyId },
        date: {
          gte: new Date(`${window.from}T00:00:00Z`),
          lte: new Date(`${window.to}T00:00:00Z`),
        },
      },
      select: { pitchId: true, date: true },
    }),
  ])

  const f: Figures = {
    buckets: new Map(
      bucketsBetween(window.from, window.to, groupBy).map(period => [
        period,
        { period, gross: 0, online: 0, atVenue: 0, bookings: 0 },
      ])
    ),
    online: 0,
    atVenue: 0,
    gross: 0,
    counted: 0,
    noShows: 0,
    open: 0,
    booked: 0,
    gridOpen: grid(),
    gridBooked: grid(),
    pitches: new Map(
      pitches.map(p => [
        p.id,
        { revenue: 0, total: 0, played: 0, cancelled: 0, noShows: 0, open: 0, booked: 0 },
      ])
    ),
  }

  // Open time: each pitch's hours on each day, today only up to now.
  const week = normalizeWeek(company.workingHours)
  const closed = new Set(exceptions.map(e => `${e.pitchId}|${e.date.toISOString().slice(0, 10)}`))
  for (const p of pitches) {
    const schedule: PitchSchedule = {
      id: p.id,
      isActive: p.isActive,
      advanceBookingDays: 0,
      week,
      pitchWeek: p.workingHours ? normalizeWeek(p.workingHours) : null,
    }
    const row = f.pitches.get(p.id)!
    for (let d = window.from; d <= window.to && d <= today; d = addDays(d, 1)) {
      const off = new Set(closed.has(`${p.id}|${d}`) ? [d] : [])
      for (const [a, b] of dayIntervals(schedule, d, off)) {
        const to = d === today ? Math.min(b, nowMinutes) : b
        if (to <= a) continue
        spread(f.gridOpen, dayOfWeek(d), a, to)
        row.open += to - a
        f.open += to - a
      }
    }
  }

  for (const b of bookings) {
    const row = f.pitches.get(b.pitchId)
    const at = venueClock(b.startTime)
    const earned = bookingEarned({
      status: b.status,
      started: b.startTime <= now,
      total: Number(b.totalAmount),
      paymentMethod: b.paymentMethod,
      deposit: b.depositAmount === null ? null : Number(b.depositAmount),
      dueAtVenue: Number(b.dueAtVenue),
      paid: !!b.paidAt,
      refunded: b.refundAmount === null ? null : Number(b.refundAmount),
    })
    const bucket = f.buckets.get(bucketOf(at.date, groupBy))
    if (bucket) {
      bucket.gross += earned.gross
      bucket.online += earned.online
      bucket.atVenue += earned.atVenue
      if (earned.counted) bucket.bookings++
    }
    f.gross += earned.gross
    f.online += earned.online
    f.atVenue += earned.atVenue
    if (earned.counted) f.counted++
    if (b.status === 'NO_SHOW') f.noShows++
    if (row) {
      row.revenue += earned.gross
      row.total++
      if (earned.counted && b.status !== 'NO_SHOW') row.played++
      if (b.status === 'CANCELLED') row.cancelled++
      if (b.status === 'NO_SHOW') row.noShows++
    }

    // Booked time: games that took place, up to now.
    if (!OCCUPYING.has(b.status) || b.startTime > now) continue
    const endAt = b.endTime < now ? b.endTime : now
    const end = venueClock(endAt)
    const to = end.date === at.date ? end.minutes : 24 * 60
    if (to <= at.minutes) continue
    spread(f.gridBooked, dayOfWeek(at.date), at.minutes, to)
    f.booked += to - at.minutes
    if (row) row.booked += to - at.minutes
  }

  for (const p of f.buckets.values()) {
    p.gross = Math.round(p.gross * 100) / 100
    p.online = Math.round(p.online * 100) / 100
    p.atVenue = Math.round(p.atVenue * 100) / 100
  }
  return f
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : null

async function averageRating(
  companyId: string,
  window: Window,
  pitchId?: string
): Promise<{
  avg: number | null
  count: number
  byPitch: Map<string, { avg: number; count: number }>
}> {
  const rows = await prisma.review.groupBy({
    by: ['pitchId'],
    where: {
      pitch: { companyId },
      ...(pitchId ? { pitchId } : {}),
      moderationStatus: 'APPROVED',
      deletedAt: null,
      createdAt: {
        gte: venueTimeToUtc(window.from, 0),
        lt: venueTimeToUtc(addDays(window.to, 1), 0),
      },
    },
    _avg: { rating: true },
    _count: { _all: true },
  })
  let sum = 0
  let count = 0
  const byPitch = new Map<string, { avg: number; count: number }>()
  for (const r of rows) {
    const avg = r._avg.rating ?? 0
    sum += avg * r._count._all
    count += r._count._all
    byPitch.set(r.pitchId, { avg: Math.round(avg * 10) / 10, count: r._count._all })
  }
  return { avg: count ? Math.round((sum / count) * 10) / 10 : null, count, byPitch }
}

// ── The endpoints ───────────────────────────────────────────────────────────

/** E14-01: revenue by day, week or month, every bucket present. */
export async function analyticsRevenue(
  companyId: string,
  period: AnalyticsPeriod,
  pitchId?: string,
  now: Date = new Date()
): Promise<AnalyticsRevenue> {
  const range = analyticsRange(period, venueClock(now).date)
  const f = await figures(companyId, range, range.groupBy, pitchId, now)
  return { period, groupBy: range.groupBy, data: [...f.buckets.values()] }
}

/** E14-02: the share of open time booked, by day of week and hour. */
export async function analyticsOccupancy(
  companyId: string,
  period: AnalyticsPeriod,
  pitchId?: string,
  now: Date = new Date()
): Promise<AnalyticsOccupancy> {
  const range = analyticsRange(period, venueClock(now).date)
  const f = await figures(companyId, range, range.groupBy, pitchId, now)
  return {
    period,
    grid: f.gridOpen.map((hours, day) =>
      hours.map((open, hour) => pct(f.gridBooked[day]![hour]!, open))
    ),
  }
}

/** E14-04: the five cards, each against the same length just before. */
export async function analyticsSummary(
  companyId: string,
  period: AnalyticsPeriod,
  pitchId?: string,
  now: Date = new Date()
): Promise<AnalyticsSummary> {
  const range = analyticsRange(period, venueClock(now).date)
  const prior = { from: range.priorFrom, to: range.priorTo }
  const [cur, before, rating, priorRating] = await Promise.all([
    figures(companyId, range, range.groupBy, pitchId, now),
    figures(companyId, prior, range.groupBy, pitchId, now),
    averageRating(companyId, range, pitchId),
    averageRating(companyId, prior, pitchId),
  ])
  const round = (n: number) => Math.round(n * 100) / 100
  const noShowRate = (x: Figures) => pct(x.noShows, x.counted)
  // A window with nothing in it has nothing to compare with.
  const had = before.counted > 0 || before.gross > 0
  const vs = (a: number | null, b: number | null) => (had ? percentChange(a, b) : null)
  return {
    period,
    revenue: {
      value: round(cur.gross),
      change: vs(cur.gross, before.gross),
      online: round(cur.online),
      atVenue: round(cur.atVenue),
    },
    bookings: { value: cur.counted, change: vs(cur.counted, before.counted) },
    occupancy: {
      value: pct(cur.booked, cur.open),
      change: vs(pct(cur.booked, cur.open), pct(before.booked, before.open)),
    },
    avgRating: { value: rating.avg, change: percentChange(rating.avg, priorRating.avg) },
    noShowRate: { value: noShowRate(cur), change: vs(noShowRate(cur), noShowRate(before)) },
  }
}

/** E14-03: one row per pitch, deleted pitches left out. */
export async function analyticsPitches(
  companyId: string,
  period: AnalyticsPeriod,
  now: Date = new Date()
): Promise<PitchPerformanceRow[]> {
  const range = analyticsRange(period, venueClock(now).date)
  const [f, rating, pitches] = await Promise.all([
    figures(companyId, range, range.groupBy, undefined, now),
    averageRating(companyId, range),
    prisma.pitch.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, isActive: true },
    }),
  ])
  return pitches.map(p => {
    const s = f.pitches.get(p.id)!
    const r = rating.byPitch.get(p.id)
    return {
      pitchId: p.id,
      name: p.name,
      isActive: p.isActive,
      revenue: Math.round(s.revenue * 100) / 100,
      totalBookings: s.total,
      completedBookings: s.played,
      occupancy: pct(s.booked, s.open),
      cancellationRate: pct(s.cancelled, s.total) ?? 0,
      noShowRate: pct(s.noShows, s.total) ?? 0,
      avgRating: r?.avg ?? null,
      reviewCount: r?.count ?? 0,
    }
  })
}

const PAYMENT_WORDS = {
  ONLINE: 'analytics.csv.paymentOnline',
  VENUE_DEPOSIT_TOWARDS: 'analytics.csv.paymentDepositTowards',
  VENUE_REFUND_DEPOSIT: 'analytics.csv.paymentDepositRefunded',
} as const

/**
 * E14-05: every booking of the period with what it earned, newest first, at
 * most 10,000. No trust score: managers don't see it (PRD §9.1), and a CSV
 * leaves the platform.
 */
export async function analyticsCsv(
  companyId: string,
  period: AnalyticsPeriod,
  pitchId?: string,
  now: Date = new Date()
): Promise<{ csv: string; truncated: boolean; filename: string }> {
  const range = analyticsRange(period, venueClock(now).date)
  const rows = await prisma.booking.findMany({
    where: {
      pitch: { companyId },
      ...(pitchId ? { pitchId } : {}),
      startTime: {
        gte: venueTimeToUtc(range.from, 0),
        lt: venueTimeToUtc(addDays(range.to, 1), 0),
      },
      status: { not: 'PENDING' },
    },
    orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
    take: ANALYTICS_EXPORT_LIMIT + 1,
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      teamCount: true,
      airType: true,
      totalAmount: true,
      paymentMethod: true,
      depositAmount: true,
      dueAtVenue: true,
      paidAt: true,
      refundAmount: true,
      pitch: { select: { name: true, size: true } },
      player: { select: { name: true } },
    },
  })
  const truncated = rows.length > ANALYTICS_EXPORT_LIMIT
  const t = webT(await getLocale())
  const header = csvLine(
    (
      [
        'reference',
        'date',
        'start',
        'end',
        'pitch',
        'size',
        'air',
        'player',
        'status',
        'price',
        'payment',
        'earned',
        'online',
        'atVenue',
        'refunded',
        'teams',
      ] as const
    ).map(column => t(`analytics.csv.${column}`))
  )
  const lines = rows.slice(0, ANALYTICS_EXPORT_LIMIT).map(b => {
    const s = venueClock(b.startTime)
    const e = venueClock(b.endTime)
    const earned = bookingEarned({
      status: b.status,
      started: b.startTime <= now,
      total: Number(b.totalAmount),
      paymentMethod: b.paymentMethod,
      deposit: b.depositAmount === null ? null : Number(b.depositAmount),
      dueAtVenue: Number(b.dueAtVenue),
      paid: !!b.paidAt,
      refunded: b.refundAmount === null ? null : Number(b.refundAmount),
    })
    return csvLine([
      bookingReference(b.id),
      s.date,
      fromMinutes(s.minutes),
      endLabel(e.date === s.date ? e.minutes : 24 * 60),
      b.pitch.name,
      t.has(`size.${b.pitch.size}`) ? t(`size.${b.pitch.size}` as 'size.CUSTOM') : b.pitch.size,
      b.airType ? t(`air.${b.airType}`) : '',
      b.player.name,
      t(`bookingStatus.${b.status}`),
      Number(b.totalAmount),
      t(PAYMENT_WORDS[b.paymentMethod]),
      earned.gross,
      earned.online,
      earned.atVenue,
      b.refundAmount === null ? '' : Number(b.refundAmount),
      b.teamCount,
    ])
  })
  return {
    // A BOM so Excel reads the Romanian letters as UTF-8.
    csv: `${String.fromCharCode(0xfeff)}${[header, ...lines].join('\r\n')}\r\n`,
    truncated,
    filename: `pitchup-analytics-${period}-${range.to}.csv`,
  }
}
