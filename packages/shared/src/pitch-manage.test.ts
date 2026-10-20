import { describe, expect, it } from 'vitest'
import {
  PitchBasicInfoSchema,
  PitchPricingSchema,
  PitchShirtsSchema,
  ReorderPhotosSchema,
  intersectIntervals,
  pitchDayError,
} from './index'

const day = (openTime: string, closeTime: string, isClosed = false) => ({
  day: 1,
  openTime,
  closeTime,
  isClosed,
})

describe('pitchDayError (E10-10)', () => {
  const venue = day('08:00', '23:00')
  it('allows hours inside the venue’s, and a closed pitch on any day', () => {
    expect(pitchDayError(day('10:00', '22:00'), venue, 'en')).toBeNull()
    expect(pitchDayError(day('08:00', '23:00'), venue, 'en')).toBeNull()
    expect(pitchDayError(day('00:00', '00:00', true), day('00:00', '00:00', true), 'en')).toBeNull()
  })

  it('refuses opening earlier, closing later, or opening when the venue is closed', () => {
    expect(pitchDayError(day('07:00', '22:00'), venue, 'en')).toBe('Opens before the venue (08:00)')
    expect(pitchDayError(day('09:00', '23:30'), venue, 'en')).toBe('Closes after the venue (23:00)')
    expect(pitchDayError(day('09:00', '01:00'), venue, 'en')).toBe('Closes after the venue (23:00)')
    expect(pitchDayError(day('10:00', '12:00'), day('00:00', '00:00', true), 'en')).toBe(
      'The venue is closed on this day'
    )
  })

  it('understands a venue open past midnight', () => {
    const late = day('16:00', '02:00')
    expect(pitchDayError(day('18:00', '01:00'), late, 'en')).toBeNull()
    expect(pitchDayError(day('18:00', '03:00'), late, 'en')).toBe('Closes after the venue (02:00)')
  })
})

it('intersectIntervals keeps only the overlap', () => {
  expect(
    intersectIntervals(
      [
        [0, 120],
        [480, 1440],
      ],
      [[600, 840]]
    )
  ).toEqual([[600, 840]])
  expect(
    intersectIntervals(
      [[480, 1440]],
      [
        [0, 60],
        [1200, 1500],
      ]
    )
  ).toEqual([[1200, 1440]])
  expect(intersectIntervals([[480, 600]], [[600, 700]])).toEqual([])
})

describe('editor schemas', () => {
  it('a custom size needs both dimensions', () => {
    const base = { name: 'Teren', surfaceType: 'FUTSAL', size: 'CUSTOM' }
    expect(PitchBasicInfoSchema.safeParse(base).success).toBe(false)
    expect(
      PitchBasicInfoSchema.safeParse({ ...base, widthMeters: 20, lengthMeters: 40 }).success
    ).toBe(true)
    expect(PitchBasicInfoSchema.safeParse({ ...base, size: 'SIX_A_SIDE' }).success).toBe(true)
  })

  it('pricing: one rate, limits from the lists, shortest no longer than longest', () => {
    const ok = { hourlyRate: 120, minBookingHours: 1, maxBookingHours: 4, advanceBookingDays: 60 }
    expect(PitchPricingSchema.safeParse(ok).success).toBe(true)
    expect(PitchPricingSchema.safeParse({ ...ok, hourlyRate: 0 }).success).toBe(false)
    expect(PitchPricingSchema.safeParse({ ...ok, minBookingHours: 3 }).success).toBe(false)
    // Half hours are fine (1h 30 to 3h 30); other fractions are not.
    expect(
      PitchPricingSchema.safeParse({ ...ok, minBookingHours: 1.5, maxBookingHours: 3.5 }).success
    ).toBe(true)
    expect(PitchPricingSchema.safeParse({ ...ok, minBookingHours: 1.25 }).success).toBe(false)
    expect(
      PitchPricingSchema.safeParse({ ...ok, minBookingHours: 2, maxBookingHours: 2 }).success
    ).toBe(true)
    expect(PitchPricingSchema.safeParse({ ...ok, advanceBookingDays: 45 }).success).toBe(false)
  })

  it('shirts: lending needs at least one set; each colour once', () => {
    expect(PitchShirtsSchema.safeParse({ hasShirts: false }).success).toBe(true)
    expect(
      PitchShirtsSchema.safeParse({ hasShirts: true, inventory: [{ colour: 'RED', quantity: 0 }] })
        .success
    ).toBe(false)
    expect(
      PitchShirtsSchema.safeParse({
        hasShirts: true,
        inventory: [
          { colour: 'RED', quantity: 1 },
          { colour: 'RED', quantity: 2 },
        ],
      }).success
    ).toBe(false)
  })

  it('reorder takes at most ten photos', () => {
    expect(ReorderPhotosSchema.safeParse({ photoIds: Array(11).fill('x') }).success).toBe(false)
  })
})
