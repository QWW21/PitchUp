import { describe, expect, it } from 'vitest'
import {
  ALL_AMENITIES,
  AMENITY_LABELS,
  formatPeakHours,
  formatPitchSize,
  playerDisplayName,
} from './format'
import { trustTier } from './constants/trust'

describe('playerDisplayName', () => {
  it('shows first name and last initial', () => {
    expect(playerDisplayName('Alexandru David Serea', false)).toBe('Alexandru S.')
  })
  it('keeps a single name as is', () => {
    expect(playerDisplayName('Ion', false)).toBe('Ion')
  })
  it('collapses extra spaces', () => {
    expect(playerDisplayName('  Maria   popescu ', false)).toBe('Maria P.')
  })
  it('hides everything for an anonymous review', () => {
    expect(playerDisplayName('Alexandru Serea', true)).toBe('Anonymous player')
  })
})

describe('formatPeakHours', () => {
  it('is null when there is no peak window', () => {
    expect(formatPeakHours([])).toBeNull()
  })
  it('groups weekdays into a range and keeps a pair as a list', () => {
    expect(
      formatPeakHours([
        { days: [1, 2, 3, 4, 5], startTime: '17:00', endTime: '23:00' },
        { days: [0, 6], startTime: '08:00', endTime: '23:00' },
      ])
    ).toBe('Mon–Fri 17:00–23:00 + Sat, Sun 08:00–23:00')
  })
  it('says "Every day" for all seven', () => {
    expect(
      formatPeakHours([{ days: [0, 1, 2, 3, 4, 5, 6], startTime: '18:00', endTime: '22:00' }])
    ).toBe('Every day 18:00–22:00')
  })
  it('splits non-contiguous days into runs', () => {
    expect(formatPeakHours([{ days: [1, 2, 3, 5], startTime: '18:00', endTime: '22:00' }])).toBe(
      'Mon–Wed, Fri 18:00–22:00'
    )
  })
})

describe('formatPitchSize', () => {
  it('adds dimensions when known', () => {
    expect(formatPitchSize('5v5', 25, 40)).toBe('5v5 (25×40m)')
    expect(formatPitchSize('5v5', null, 40)).toBe('5v5')
  })
})

describe('AMENITY_LABELS', () => {
  it('labels all fourteen amenity types', () => {
    expect(ALL_AMENITIES).toHaveLength(14)
    expect(ALL_AMENITIES.every(a => AMENITY_LABELS[a].length > 0)).toBe(true)
  })
})

describe('trustTier', () => {
  it.each([
    [100, 'Excellent', true],
    [90, 'Excellent', true],
    [89, 'Good', true],
    [70, 'Good', true],
    [50, 'Fair', true],
    [30, 'Poor', true],
    [29, 'Suspended', false],
    [0, 'Suspended', false],
  ])('score %i → %s (can book: %s)', (score, label, canBook) => {
    expect(trustTier(score)).toMatchObject({ label, canBook })
  })
})
