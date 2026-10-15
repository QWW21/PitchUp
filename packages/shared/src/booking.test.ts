import { describe, expect, it } from 'vitest'
import {
  bookingPrice,
  bookingReference,
  formatDuration,
  freeCancellationUntil,
  rangeTimes,
  refundPercentFor,
  tapSlot,
  type SlotRange,
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

describe('tapSlot', () => {
  const day = (spec: string, from = '18:00'): { time: string; status: SlotStatus }[] => {
    const [h, m] = from.split(':').map(Number)
    return [...spec].map((c, i) => {
      const minutes = h! * 60 + m! + i * 30
      const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
      return { time, status: c === '.' ? 'available' : c === 'x' ? 'booked' : 'past' }
    })
  }
  const FOUR_HOURS = 240

  it('starts, extends, and clears when the start is tapped again', () => {
    const slots = day('......')
    let s: SlotRange | null = tapSlot(slots, null, 1, FOUR_HOURS)
    expect(s).toEqual({ start: 1, end: 1 })
    s = tapSlot(slots, s, 4, FOUR_HOURS)
    expect(s).toEqual({ start: 1, end: 4 })
    expect(rangeTimes(slots, s!)).toEqual({ startTime: '18:30', endTime: '20:30', minutes: 120 })
    expect(tapSlot(slots, s, 1, FOUR_HOURS)).toBeNull()
  })

  it('starts over when the tap is above the start', () => {
    expect(tapSlot(day('......'), { start: 3, end: 4 }, 1, FOUR_HOURS)).toEqual({
      start: 1,
      end: 1,
    })
  })

  it('stops before a booked slot', () => {
    expect(tapSlot(day('..x...'), { start: 0, end: 0 }, 5, FOUR_HOURS)).toEqual({
      start: 0,
      end: 1,
    })
  })

  it('ignores taps on booked and past slots', () => {
    const slots = day('p.x.')
    expect(tapSlot(slots, null, 0, FOUR_HOURS)).toBeNull()
    expect(tapSlot(slots, { start: 1, end: 1 }, 2, FOUR_HOURS)).toEqual({ start: 1, end: 1 })
  })

  it('stops at the longest booking allowed', () => {
    expect(tapSlot(day('..........'), { start: 0, end: 0 }, 9, 120)).toEqual({ start: 0, end: 3 })
  })

  it('stops at a gap in the opening hours', () => {
    const slots = [...day('..', '10:00'), ...day('..', '17:00')]
    expect(tapSlot(slots, { start: 0, end: 0 }, 3, FOUR_HOURS)).toEqual({ start: 0, end: 1 })
  })

  it('writes an end at midnight as 24:00', () => {
    const slots = day('..', '23:00')
    expect(rangeTimes(slots, { start: 0, end: 1 }).endTime).toBe('24:00')
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
