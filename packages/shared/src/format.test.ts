import { describe, expect, it } from 'vitest'
import {
  ALL_AMENITIES,
  AMENITY_LABELS,
  formatPitchSize,
  formatShirtColours,
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

describe('formatShirtColours', () => {
  it('lists the colours a pitch can lend, skipping empty ones', () => {
    expect(
      formatShirtColours([
        { colour: 'BLUE', quantity: 2 },
        { colour: 'RED', quantity: 0 },
        { colour: 'YELLOW', quantity: 1 },
      ])
    ).toBe('blue and yellow')
    expect(formatShirtColours([{ colour: 'RED', quantity: 1 }])).toBe('red')
    expect(formatShirtColours([])).toBe('')
  })
})
