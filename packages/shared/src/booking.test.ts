import { describe, expect, it } from 'vitest'
import {
  bookingPrice,
  bookingReference,
  formatDuration,
  freeCancellationUntil,
  dayPeriod,
  durationOptions,
  formatShortDuration,
  keepDuration,
  rangeFrom,
  rangeTimes,
  refundPercentFor,
  startOptions,
} from './booking'
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

describe('cancellation policy (PRD §9.2)', () => {
  it.each([
    [48, 100],
    [24, 100],
    [23.9, 50],
    [2, 50],
    [1.9, 0],
    [-1, 0],
  ])('%s h before → %i%%', (hours, percent) => {
    expect(refundPercentFor(hours)).toBe(percent)
  })
  it('is free until 24 hours before kick-off', () => {
    expect(freeCancellationUntil(new Date('2026-11-02T18:00:00Z')).toISOString()).toBe(
      '2026-11-01T18:00:00.000Z'
    )
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

it('formats dates without Intl', async () => {
  const { formatDateLong, formatMonth } = await import('./booking')
  expect(formatDateLong('2026-11-05')).toBe('Thursday, 5 November 2026')
  expect(formatMonth('2026-02-14')).toBe('February 2026')
})

describe('cancellationRefund', () => {
  const start = new Date('2026-11-10T18:00:00Z')
  const at = (hoursBefore: number) => new Date(start.getTime() - hoursBefore * 3_600_000)
  it.each([
    [48, 100, 240],
    [24, 100, 240],
    [23.99, 50, 120],
    [2, 50, 120],
    [1.99, 0, 0],
  ])('%s h before → %i%% = %i RON', async (hours, percent, amount) => {
    const { cancellationRefund } = await import('./booking')
    expect(cancellationRefund(240, start, at(hours))).toEqual({ percent, amount })
  })
  it('keeps bani', async () => {
    const { cancellationRefund } = await import('./booking')
    expect(cancellationRefund(135, start, at(5)).amount).toBe(67.5)
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
    expect(formatCountdown(new Date(now.getTime() + minutes * 60_000), now)).toBe(text)
  })
})
