import { describe, expect, it } from 'vitest'
import { ALL_AMENITIES, formatPitchSize, formatShirtColours, playerDisplayName } from './format'
import { trustTier } from './constants/trust'
import { sharedT } from './i18n'

describe('playerDisplayName', () => {
  it('shows first name and last initial', () => {
    expect(playerDisplayName('Alexandru David Serea', false, 'en')).toBe('Alexandru S.')
  })
  it('keeps a single name as is', () => {
    expect(playerDisplayName('Ion', false, 'en')).toBe('Ion')
  })
  it('collapses extra spaces', () => {
    expect(playerDisplayName('  Maria   popescu ', false, 'en')).toBe('Maria P.')
  })
  it('hides everything for an anonymous review', () => {
    expect(playerDisplayName('Alexandru Serea', true, 'en')).toBe('Anonymous player')
    expect(playerDisplayName('Alexandru Serea', true, 'ro')).toBe('Jucător anonim')
  })
})

describe('formatPitchSize', () => {
  it('adds dimensions when known', () => {
    expect(formatPitchSize('5v5', 25, 40, 'en')).toBe('5v5 (25×40m)')
    expect(formatPitchSize('5v5', 25, 40, 'ro')).toBe('5v5 (25×40 m)')
    expect(formatPitchSize('5v5', null, 40, 'en')).toBe('5v5')
  })
})

describe('amenity names', () => {
  it('names all fourteen amenity types in both languages', () => {
    expect(ALL_AMENITIES).toHaveLength(14)
    for (const locale of ['en', 'ro'] as const) {
      const t = sharedT(locale)
      expect(ALL_AMENITIES.every(a => t.has(`amenity.${a}`))).toBe(true)
    }
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
      formatShirtColours(
        [
          { colour: 'BLUE', quantity: 2 },
          { colour: 'RED', quantity: 0 },
          { colour: 'YELLOW', quantity: 1 },
        ],
        'en'
      )
    ).toBe('blue and yellow')
    expect(formatShirtColours([{ colour: 'RED', quantity: 1 }], 'en')).toBe('red')
    expect(formatShirtColours([], 'en')).toBe('')
    expect(
      formatShirtColours(
        [
          { colour: 'BLUE', quantity: 2 },
          { colour: 'YELLOW', quantity: 1 },
        ],
        'ro'
      )
    ).toBe('albastru și galben')
  })
})
