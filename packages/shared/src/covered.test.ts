import { describe, expect, it } from 'vitest'
import {
  CoveredSeasonSchema,
  airOptionsOn,
  isCoveredOn,
  rateFor,
  seasonsOverlap,
  type CoveredPricing,
} from './covered'

const winter = { startDate: '2026-11-01', endDate: '2027-03-31' }
const both: CoveredPricing = {
  hourlyRate: 150,
  coveredColdRate: 180,
  coveredHotRate: 220,
  seasons: [winter],
}

describe('covered season', () => {
  it('uses the all-year rate on an uncovered day', () => {
    expect(isCoveredOn(both, '2026-10-31')).toBe(false)
    expect(airOptionsOn(both, '2026-10-31')).toEqual([])
    expect(rateFor(both, '2026-10-31')).toEqual({ rate: 150, airType: null })
  })

  it('covers the first and last day of a season', () => {
    expect(isCoveredOn(both, '2026-11-01')).toBe(true)
    expect(isCoveredOn(both, '2027-03-31')).toBe(true)
    expect(isCoveredOn(both, '2027-04-01')).toBe(false)
  })

  it('offers both and defaults to cold', () => {
    expect(airOptionsOn(both, '2026-12-10')).toEqual(['COLD', 'HOT'])
    expect(rateFor(both, '2026-12-10')).toEqual({ rate: 180, airType: 'COLD' })
    expect(rateFor(both, '2026-12-10', 'HOT')).toEqual({ rate: 220, airType: 'HOT' })
  })

  it('applies the only air offered', () => {
    const cold = { ...both, coveredHotRate: null }
    const hot = { ...both, coveredColdRate: null }
    expect(airOptionsOn(cold, '2026-12-10')).toEqual(['COLD'])
    expect(rateFor(cold, '2026-12-10')).toEqual({ rate: 180, airType: 'COLD' })
    expect(airOptionsOn(hot, '2026-12-10')).toEqual(['HOT'])
    expect(rateFor(hot, '2026-12-10')).toEqual({ rate: 220, airType: 'HOT' })
  })

  it('rejects air that is not offered that day', () => {
    expect(rateFor({ ...both, coveredHotRate: null }, '2026-12-10', 'HOT')).toBeNull()
    expect(rateFor(both, '2026-10-01', 'COLD')).toBeNull()
  })

  it('handles two seasons', () => {
    const two = { ...both, seasons: [winter, { startDate: '2027-11-01', endDate: '2028-03-31' }] }
    expect(isCoveredOn(two, '2027-06-01')).toBe(false)
    expect(isCoveredOn(two, '2027-11-15')).toBe(true)
  })

  it('treats seasons that share a day as overlapping', () => {
    expect(seasonsOverlap(winter, { startDate: '2027-03-31', endDate: '2027-04-10' })).toBe(true)
    expect(seasonsOverlap(winter, { startDate: '2027-04-01', endDate: '2027-04-10' })).toBe(false)
  })
})

describe('CoveredSeasonSchema', () => {
  it('accepts a winter', () => {
    expect(CoveredSeasonSchema.safeParse(winter).success).toBe(true)
  })
  it('refuses an end before the start', () => {
    const r = CoveredSeasonSchema.safeParse({ startDate: '2026-12-01', endDate: '2026-11-01' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('v.startAfterEnd')
  })
  it('refuses a season over 200 days', () => {
    const r = CoveredSeasonSchema.safeParse({ startDate: '2026-11-01', endDate: '2027-07-01' })
    expect(r.error?.issues[0]?.message).toBe('v.seasonTooLong')
  })
  it('refuses a date that does not exist', () => {
    expect(
      CoveredSeasonSchema.safeParse({ startDate: '2026-02-30', endDate: '2026-03-01' }).success
    ).toBe(false)
  })
})
