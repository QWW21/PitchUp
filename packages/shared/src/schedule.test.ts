import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayOfWeek,
  formatDayHours,
  isOpenAt,
  normalizeWeek,
  openIntervalsOn,
  todayStatus,
  venueClock,
  venueTimeToUtc,
  type DayHours,
} from './schedule'

const daily = (openTime: string, closeTime: string) =>
  [0, 1, 2, 3, 4, 5, 6].map(day => ({ day, openTime, closeTime, isClosed: false }))

/** 2026-10-14 is a Wednesday; Bucharest is UTC+3 until DST ends on 2026-10-25. */
const wedUtc = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00Z`)

describe('venueClock', () => {
  it('reads the Bucharest wall clock, not UTC', () => {
    expect(venueClock(wedUtc('21:30'))).toEqual({ date: '2026-10-15', day: 4, minutes: 30 })
  })
  it('handles winter time (UTC+2)', () => {
    expect(venueClock(new Date('2026-12-01T10:00:00Z'))).toMatchObject({ minutes: 12 * 60 })
  })
})

describe('venueTimeToUtc', () => {
  it('converts summer wall-clock time', () => {
    expect(venueTimeToUtc('2026-10-14', 10 * 60).toISOString()).toBe('2026-10-14T07:00:00.000Z')
  })
  it('converts winter wall-clock time', () => {
    expect(venueTimeToUtc('2026-12-01', 10 * 60).toISOString()).toBe('2026-12-01T08:00:00.000Z')
  })
  it('lands on the right side of the autumn DST change', () => {
    // 2026-10-25: clocks go back at 04:00 local. 10:00 that day is UTC+2.
    expect(venueTimeToUtc('2026-10-25', 10 * 60).toISOString()).toBe('2026-10-25T08:00:00.000Z')
  })
  it('lands on the right side of the spring DST change', () => {
    // 2026-03-29: clocks go forward at 03:00 local. 10:00 that day is UTC+3.
    expect(venueTimeToUtc('2026-03-29', 10 * 60).toISOString()).toBe('2026-03-29T07:00:00.000Z')
  })
  it('accepts 24:00 as the next midnight', () => {
    expect(venueTimeToUtc('2026-10-14', 24 * 60).toISOString()).toBe('2026-10-14T21:00:00.000Z')
  })
  it('round-trips through venueClock', () => {
    const at = venueTimeToUtc('2026-07-01', 18 * 60 + 30)
    expect(venueClock(at)).toMatchObject({ date: '2026-07-01', minutes: 18 * 60 + 30 })
  })
})

describe('addDays / dayOfWeek', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('is not shifted by DST', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })
  it('knows the weekday', () => {
    expect(dayOfWeek('2026-10-14')).toBe(3)
    expect(dayOfWeek('2026-10-18')).toBe(0)
  })
})

describe('normalizeWeek', () => {
  it('always returns seven days, Sunday first', () => {
    const week = normalizeWeek([{ day: 2, openTime: '09:00', closeTime: '17:00', isClosed: false }])
    expect(week.map(d => d.day)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(week[2]).toMatchObject({ openTime: '09:00', isClosed: false })
    expect(week.filter(d => d.isClosed)).toHaveLength(6)
  })
  it('treats unreadable hours as closed every day', () => {
    expect(normalizeWeek(null).every(d => d.isClosed)).toBe(true)
    expect(normalizeWeek({ nonsense: true }).every(d => d.isClosed)).toBe(true)
  })
})

describe('isOpenAt', () => {
  it('is open inside the hours and closed outside', () => {
    expect(isOpenAt(daily('08:00', '23:00'), wedUtc('06:00'))).toBe(true) // 09:00
    expect(isOpenAt(daily('08:00', '23:00'), wedUtc('04:59'))).toBe(false) // 07:59
  })
  it('treats the close time as exclusive', () => {
    expect(isOpenAt(daily('08:00', '23:00'), wedUtc('20:00'))).toBe(false) // 23:00
  })
  it('stays open past midnight on the previous day’s overnight hours', () => {
    expect(isOpenAt(daily('16:00', '02:00'), wedUtc('22:00'))).toBe(true) // 01:00 Thu
    expect(isOpenAt(daily('16:00', '02:00'), wedUtc('23:30'))).toBe(false) // 02:30 Thu
  })
  it('is always open for 00:00–00:00', () => {
    expect(isOpenAt(daily('00:00', '00:00'), wedUtc('01:30'))).toBe(true)
  })
  it('respects a closed day', () => {
    const hours = daily('08:00', '22:00').map(d => (d.day === 3 ? { ...d, isClosed: true } : d))
    expect(isOpenAt(hours, wedUtc('09:00'))).toBe(false)
  })
  it('counts missing hours as closed', () => {
    expect(isOpenAt(undefined, wedUtc('09:00'))).toBe(false)
  })
})

describe('openIntervalsOn', () => {
  it('gives one interval for normal hours', () => {
    expect(openIntervalsOn(normalizeWeek(daily('08:00', '23:00')), '2026-10-14')).toEqual([
      [480, 1380],
    ])
  })
  it('splits overnight hours into the morning tail and the evening up to 24:00', () => {
    expect(openIntervalsOn(normalizeWeek(daily('16:00', '02:00')), '2026-10-14')).toEqual([
      [0, 120],
      [960, 1440],
    ])
  })
  it('gives the whole day for round-the-clock hours', () => {
    expect(openIntervalsOn(normalizeWeek(daily('00:00', '00:00')), '2026-10-14')).toEqual([
      [0, 1440],
    ])
  })
  it('gives nothing on a closed day', () => {
    const week = normalizeWeek(daily('08:00', '22:00').map(d => ({ ...d, isClosed: d.day === 3 })))
    expect(openIntervalsOn(week, '2026-10-14')).toEqual([])
  })
})

describe('todayStatus', () => {
  const week = daily('08:00', '23:00')
  it('says when an open venue closes', () => {
    expect(todayStatus(week, wedUtc('09:00'))).toEqual({ kind: 'open', closesAt: '23:00' })
  })
  it('says when a venue opens later today', () => {
    expect(todayStatus(week, wedUtc('03:00'))).toEqual({ kind: 'opensLater', opensAt: '08:00' })
  })
  it('says closed after closing time and on closed days', () => {
    expect(todayStatus(week, wedUtc('20:30'))).toEqual({ kind: 'closedToday' })
    const closedWed = week.map(d => ({ ...d, isClosed: d.day === 3 }))
    expect(todayStatus(closedWed, wedUtc('09:00'))).toEqual({ kind: 'closedToday' })
  })
  it('uses yesterday’s overnight hours after midnight', () => {
    expect(todayStatus(daily('16:00', '02:00'), wedUtc('22:00'))).toEqual({
      kind: 'open',
      closesAt: '02:00',
    })
  })
})

describe('formatDayHours', () => {
  const day = (o: string, c: string, isClosed = false): DayHours => ({
    day: 1,
    openTime: o,
    closeTime: c,
    isClosed,
  })
  it('formats the three cases', () => {
    expect(formatDayHours(day('08:00', '23:00'))).toBe('08:00 – 23:00')
    expect(formatDayHours(day('00:00', '00:00'))).toBe('Open 24 hours')
    expect(formatDayHours(day('08:00', '23:00', true))).toBe('Closed')
  })
})
