import { describe, expect, it } from 'vitest'
import {
  bookingPrice,
  bookingReference,
  formatDuration,
  freeCancellationUntil,
  describeRefundPolicy,
  refundPolicyOf,
  dayPeriod,
  durationOptions,
  formatShortDuration,
  keepDuration,
  rangeFrom,
  rangeTimes,
  refundPercentFor,
  startOptions,
} from './booking'
import { DEFAULT_REFUND_POLICY } from './constants/cancellation'
import type { SlotStatus } from './schemas/detail'

describe('bookingPrice', () => {
  it('is the hourly rate times the hours, whatever the time of day', () => {
    expect(bookingPrice(120, 120)).toEqual({
      minutes: 120,
      total: 240,
      platformFee: 19.2,
      venuePayout: 220.8,
    })
    expect(bookingPrice(90, 90).total).toBe(135)
  })
  it('keeps the 8% fee out of what the player pays', () => {
    const p = bookingPrice(100, 60)
    expect(p.total).toBe(100)
    expect(p.platformFee + p.venuePayout).toBe(p.total)
  })
})

describe('formatDuration', () => {
  it.each([
    [30, '30min'],
    [60, '1h 00min'],
    [90, '1h 30min'],
    [240, '4h 00min'],
  ])('%i → %s', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text)
  })
})

describe('the refund policy (C-10)', () => {
  it.each([
    [48, 100],
    [12, 100],
    [11.9, 75],
    [2, 75],
    [1.9, 0],
    [-1, 0],
  ])('by default, %s h before → %i%%', (hours, percent) => {
    expect(refundPercentFor(hours)).toBe(percent)
  })
  it("follows a venue's own policy", () => {
    const strict = { fullRefundHours: 48, partialRefundHours: 24, partialRefundPercent: 50 }
    expect(refundPercentFor(48, strict)).toBe(100)
    expect(refundPercentFor(30, strict)).toBe(50)
    expect(refundPercentFor(23, strict)).toBe(0)
  })
  it('is free until 12 hours before kick-off by default', () => {
    expect(freeCancellationUntil(new Date('2026-11-02T18:00:00Z')).toISOString()).toBe(
      '2026-11-02T06:00:00.000Z'
    )
  })
  it('says itself in one sentence', () => {
    expect(describeRefundPolicy(DEFAULT_REFUND_POLICY, 'en')).toBe(
      'Free cancellation up to 12 hours before kick-off; 75% back up to 2 hours before; nothing after.'
    )
    expect(
      describeRefundPolicy(
        { fullRefundHours: 24, partialRefundHours: 0, partialRefundPercent: 50 },
        'en'
      )
    ).toBe('Free cancellation up to 24 hours before kick-off; 50% back until kick-off.')
    expect(
      describeRefundPolicy(
        { fullRefundHours: 1, partialRefundHours: 0, partialRefundPercent: 0 },
        'en'
      )
    ).toBe('Free cancellation up to 1 hour before kick-off; nothing after.')
    expect(
      describeRefundPolicy(
        { fullRefundHours: 0, partialRefundHours: 0, partialRefundPercent: 0 },
        'en'
      )
    ).toBe('Free cancellation until kick-off.')
    expect(describeRefundPolicy(DEFAULT_REFUND_POLICY, 'ro')).toBe(
      'Anulare gratuită cu până la 12 ore înainte de meci; 75% înapoi cu până la 2 ore înainte; după aceea, nimic.'
    )
  })
  it('reads a stored policy, or falls back to the default', () => {
    const p = { fullRefundHours: 6, partialRefundHours: 1, partialRefundPercent: 40 }
    expect(refundPolicyOf(p)).toEqual(p)
    expect(refundPolicyOf(null)).toEqual(DEFAULT_REFUND_POLICY)
    expect(refundPolicyOf({ fullRefundHours: 6 })).toEqual(DEFAULT_REFUND_POLICY)
  })
})

it('bookingReference is a short upper-case code', () => {
  expect(bookingReference('cmv99p6qg0021u6zf87pw4plg')).toBe('#PW4PLG')
})

describe('start and duration (C-6)', () => {
  // One character per half hour: . free, x booked, p past.
  const day = (spec: string, from = '18:00'): { time: string; status: SlotStatus }[] => {
    const [h, m] = from.split(':').map(Number)
    return [...spec].map((c, i) => {
      const minutes = h! * 60 + m! + i * 30
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
      return { time, status: c === '.' ? 'available' : c === 'x' ? 'booked' : 'past' }
    })
  }
  const states = (slots: ReturnType<typeof day>, min: number) =>
    startOptions(slots, min)
      .map(o => o.state[0])
      .join('')
  const fits = (slots: ReturnType<typeof day>, i: number, min = 60, max = 180) =>
    durationOptions(slots, i, min, max)
      .filter(o => o.fits)
      .map(o => o.minutes)

  it('offers a start only when the shortest booking fits after it', () => {
    // Free until a booking at 20:00, then free to closing at 22:00.
    const slots = day('....x...')
    expect(states(slots, 60)).toBe('aaasbaas')
    expect(states(slots, 90)).toBe('aassbass')
  })

  it('shows past and booked starts as such', () => {
    expect(states(day('pp..x'), 60)).toBe('ppasb')
  })

  it('groups starts into morning, afternoon and evening', () => {
    expect(['11:30', '12:00', '16:30', '17:00'].map(dayPeriod)).toEqual([
      'Morning',
      'Afternoon',
      'Afternoon',
      'Evening',
    ])
  })

  it('durations run from the minimum to the maximum, enabled while they fit', () => {
    const slots = day('.....x')
    expect(durationOptions(slots, 0, 60, 180).map(o => o.minutes)).toEqual([60, 90, 120, 150, 180])
    expect(fits(slots, 0)).toEqual([60, 90, 120, 150])
    expect(fits(day('..........'), 0, 60, 120)).toEqual([60, 90, 120])
  })

  it('an overnight venue: the early hours and the evening are separate runs', () => {
    // 00:00–02:00 (last night's hours), closed, then 22:00–24:00.
    const slots = [...day('....', '00:00'), ...day('....', '22:00')]
    expect(fits(slots, 2)).toEqual([60])
    expect(fits(slots, 4)).toEqual([60, 90, 120])
    expect(states(slots, 90)).toBe('aassaass')
    expect(rangeTimes(slots, rangeFrom(4, 120))).toEqual({
      startTime: '22:00',
      endTime: '24:00',
      minutes: 120,
    })
  })

  it('keeps the chosen duration if it fits, else the longest that fits up to it', () => {
    const opts = (free: number) =>
      [60, 90, 120].map(minutes => ({ minutes, fits: minutes <= free }))
    expect(keepDuration(opts(120), 90)).toBe(90)
    expect(keepDuration(opts(90), 120)).toBe(90)
    expect(keepDuration(opts(120), null)).toBe(60)
    expect(keepDuration(opts(30), 90)).toBeNull()
  })

  it('formats the chips and the range', () => {
    expect([30, 60, 90, 120].map(formatShortDuration)).toEqual(['30 min', '1h', '1h 30', '2h'])
    expect(rangeTimes(day('......'), rangeFrom(1, 120))).toEqual({
      startTime: '18:30',
      endTime: '20:30',
      minutes: 120,
    })
  })
})

it('formats dates without Intl, in both languages', async () => {
  const { formatDateLong, formatMonth } = await import('./i18n')
  expect(formatDateLong('2026-11-05', 'en')).toBe('Thursday, 5 November 2026')
  expect(formatMonth('2026-02-14', 'en')).toBe('February 2026')
  expect(formatDateLong('2026-11-05', 'ro')).toBe('Joi, 5 noiembrie 2026')
  expect(formatMonth('2026-02-14', 'ro')).toBe('Februarie 2026')
})

describe('cancellationRefund', () => {
  const start = new Date('2026-11-10T18:00:00Z')
  const at = (hoursBefore: number) => new Date(start.getTime() - hoursBefore * 3_600_000)
  it.each([
    [48, 100, 240],
    [12, 100, 240],
    [11.99, 75, 180],
    [2, 75, 180],
    [1.99, 0, 0],
  ])('%s h before → %i%% = %i RON', async (hours, percent, amount) => {
    const { cancellationRefund } = await import('./booking')
    expect(cancellationRefund(240, start, at(hours))).toEqual({ percent, amount })
  })
  it('keeps bani', async () => {
    const { cancellationRefund } = await import('./booking')
    expect(cancellationRefund(135, start, at(5)).amount).toBe(101.25)
  })
})

describe('formatCountdown', () => {
  it.each([
    [200, '3h 20min'],
    [45, '45min'],
    [0, 'Starting now'],
    [-5, 'Starting now'],
  ])('%i minutes → %s', async (minutes, text) => {
    const { formatCountdown } = await import('./booking')
    const now = new Date('2026-11-10T12:00:00Z')
    expect(formatCountdown(new Date(now.getTime() + minutes * 60_000), 'en', now)).toBe(text)
  })
})
