import { describe, expect, it } from 'vitest'
import {
  AnalyticsQuerySchema,
  analyticsRange,
  bookingEarned,
  bucketLabel,
  bucketOf,
  bucketsBetween,
  csvField,
  csvLine,
  feesOn,
  percentChange,
  type RevenueBooking,
} from './index'

describe('periods (E14)', () => {
  it('end today, with the same length just before', () => {
    expect(analyticsRange('7d', '2026-11-10')).toEqual({
      from: '2026-11-04',
      to: '2026-11-10',
      groupBy: 'day',
      priorFrom: '2026-10-28',
      priorTo: '2026-11-03',
    })
    expect(analyticsRange('90d', '2026-11-10').groupBy).toBe('week')
  })

  it('twelve months start on the first of a month', () => {
    expect(analyticsRange('12m', '2026-11-10')).toMatchObject({
      from: '2025-12-01',
      to: '2026-11-10',
      groupBy: 'month',
      priorFrom: '2024-12-01',
      priorTo: '2025-11-30',
    })
  })

  it('defaults to 30 days and refuses anything else', () => {
    expect(AnalyticsQuerySchema.parse({}).period).toBe('30d')
    expect(AnalyticsQuerySchema.safeParse({ period: '1y' }).success).toBe(false)
  })
})

describe('buckets', () => {
  it('a day, its Monday, or the first of its month', () => {
    // 2026-11-12 is a Thursday.
    expect(bucketOf('2026-11-12', 'day')).toBe('2026-11-12')
    expect(bucketOf('2026-11-12', 'week')).toBe('2026-11-09')
    expect(bucketOf('2026-11-15', 'week')).toBe('2026-11-09')
    expect(bucketOf('2026-11-12', 'month')).toBe('2026-11-01')
  })

  it('every bucket of a period, so the chart has no gaps', () => {
    expect(bucketsBetween('2026-11-04', '2026-11-10', 'day')).toHaveLength(7)
    expect(bucketsBetween('2026-11-04', '2026-11-17', 'week')).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ])
    expect(bucketsBetween('2025-12-01', '2026-11-10', 'month')).toHaveLength(12)
  })

  it('labels', () => {
    expect(bucketLabel('2026-11-04', 'day', 'en')).toBe('4 Nov')
    expect(bucketLabel('2026-11-01', 'month', 'en')).toBe('Nov 2026')
    expect(bucketLabel('2026-11-04', 'day', 'ro')).toBe('4 nov.')
  })
})

describe('what a booking earned (decided 2026-10-17)', () => {
  const b = (over: Partial<RevenueBooking>): RevenueBooking => ({
    status: 'COMPLETED',
    started: true,
    total: 200,
    paymentMethod: 'ONLINE',
    deposit: null,
    dueAtVenue: 0,
    paid: true,
    refunded: null,
    ...over,
  })

  it('a played game: the full price, online or at the venue', () => {
    expect(bookingEarned(b({}))).toEqual({ gross: 200, online: 200, atVenue: 0, counted: true })
    expect(
      bookingEarned(b({ paymentMethod: 'VENUE_DEPOSIT_TOWARDS', deposit: 40, dueAtVenue: 160 }))
    ).toEqual({ gross: 200, online: 40, atVenue: 160, counted: true })
  })

  it('a confirmed game counts once it has started', () => {
    expect(bookingEarned(b({ status: 'CONFIRMED', started: false })).gross).toBe(0)
    expect(bookingEarned(b({ status: 'CONFIRMED', started: true })).gross).toBe(200)
  })

  it('a late cancellation: what was kept; a no-show: what was paid', () => {
    expect(bookingEarned(b({ status: 'CANCELLED', refunded: 150 }))).toEqual({
      gross: 50,
      online: 50,
      atVenue: 0,
      counted: false,
    })
    expect(bookingEarned(b({ status: 'CANCELLED', refunded: 200 })).gross).toBe(0)
    expect(
      bookingEarned(b({ status: 'NO_SHOW', paymentMethod: 'VENUE_REFUND_DEPOSIT', deposit: 40 }))
    ).toEqual({ gross: 40, online: 40, atVenue: 0, counted: true })
  })

  it('PitchUp keeps 8%', () => {
    expect(feesOn(200)).toEqual({ fees: 16, payout: 184 })
  })

  it('a change needs something to compare with', () => {
    expect(percentChange(110, 100)).toBe(10)
    expect(percentChange(5, 0)).toBeNull()
    expect(percentChange(null, 4)).toBeNull()
  })
})

describe('CSV (E14-05)', () => {
  it('quotes what needs quoting and defuses formulas', () => {
    expect(csvField('Pop, Ioana')).toBe('"Pop, Ioana"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvField(-5)).toBe('-5')
    expect(csvLine(['a', 1, null])).toBe('a,1,')
  })
})
