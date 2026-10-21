import { describe, expect, it } from 'vitest'
import {
  ManagerBookingQuerySchema,
  PITCH_COLOURS,
  calcPrice,
  generateSlots,
  isWithinNoShowWindow,
  pitchColour,
} from './index'

const start = new Date('2026-11-04T16:00:00Z')
const after = (minutes: number) => new Date(start.getTime() + minutes * 60_000)

describe('isWithinNoShowWindow (E11-04)', () => {
  it('opens 30 minutes after kick-off and closes 4 hours after', () => {
    expect(isWithinNoShowWindow(start, after(-1))).toBe(false)
    expect(isWithinNoShowWindow(start, after(29))).toBe(false)
    expect(isWithinNoShowWindow(start, after(30))).toBe(true)
    expect(isWithinNoShowWindow(start, after(180))).toBe(true)
    expect(isWithinNoShowWindow(start, after(240))).toBe(true)
    expect(isWithinNoShowWindow(start, new Date(after(240).getTime() + 1000))).toBe(false)
  })
})

describe('generateSlots (E11-10)', () => {
  it('fills the opening hours, with no partial slot at the end', () => {
    const hourly = generateSlots('08:00', '22:00', 60)
    expect(hourly).toHaveLength(14)
    expect(hourly[0]).toEqual({ start: '08:00', end: '09:00', label: '08:00–09:00' })
    expect(generateSlots('08:00', '09:45', 30).map(s => s.label)).toEqual([
      '08:00–08:30',
      '08:30–09:00',
      '09:00–09:30',
    ])
  })

  it('runs past midnight when closing is earlier than opening', () => {
    expect(generateSlots('23:00', '01:00', 60).map(s => s.label)).toEqual([
      '23:00–24:00',
      '00:00–01:00',
    ])
  })
})

it('calcPrice is rate × slots ÷ 2 (C-2)', () => {
  expect(calcPrice(120, 3)).toMatchObject({ minutes: 90, total: 180 })
})

it('pitch colours are stable by position and repeat after eight', () => {
  expect(pitchColour(0)).toBe(PITCH_COLOURS[0])
  expect(pitchColour(9)).toBe(PITCH_COLOURS[1])
})

describe('ManagerBookingQuerySchema (E11-01)', () => {
  it('clamps the page size and checks the filters', () => {
    expect(ManagerBookingQuerySchema.parse({ limit: '500' }).limit).toBe(100)
    expect(ManagerBookingQuerySchema.parse({}).limit).toBe(20)
    expect(ManagerBookingQuerySchema.safeParse({ search: 'a' }).success).toBe(false)
    expect(ManagerBookingQuerySchema.safeParse({ status: 'LOST' }).success).toBe(false)
    expect(
      ManagerBookingQuerySchema.safeParse({ dateFrom: '2026-11-05', dateTo: '2026-11-04' }).success
    ).toBe(false)
    expect(
      ManagerBookingQuerySchema.safeParse({ dateFrom: '2026-11-04', dateTo: '2026-11-04' }).success
    ).toBe(true)
  })
})
