import { describe, expect, it } from 'vitest'
import { createTranslator, pluralCategory, resolveLocale, type CatalogShape } from './core'
import { en } from './en'
import { ro } from './ro'
import { sharedT } from './index'

describe('pluralCategory', () => {
  it('English: one and other', () => {
    expect([0, 1, 2, 21].map(n => pluralCategory('en', n))).toEqual([
      'other',
      'one',
      'other',
      'other',
    ])
  })
  it('Romanian: 1 · 0, 2–19 · 20+ (and again from 101)', () => {
    expect([1, 0, 2, 19, 20, 100, 101, 119, 120].map(n => pluralCategory('ro', n))).toEqual([
      'one',
      'few',
      'few',
      'few',
      'other',
      'other',
      'few',
      'few',
      'other',
    ])
  })
})

describe('the translator', () => {
  const cat = { greet: 'Hello {name}', n: { one: '{count} game', other: '{count} games' } }
  const roCat: CatalogShape<typeof cat> = {
    greet: 'Salut {name}',
    n: { one: '{count} meci', few: '{count} meciuri', other: '{count} de meciuri' },
  }
  const t = createTranslator({ en: cat, ro: roCat }, 'ro')

  it('interpolates and picks the plural form', () => {
    expect(t('greet', { name: 'Ana' })).toBe('Salut Ana')
    expect([1, 3, 25].map(count => t('n', { count }))).toEqual([
      '1 meci',
      '3 meciuri',
      '25 de meciuri',
    ])
  })

  it('answers an unknown key with the key itself, and says so', () => {
    expect(t('nope' as 'greet')).toBe('nope')
    expect(t.has('nope')).toBe(false)
    expect(t.has('greet')).toBe(true)
  })

  it('the shared catalogs agree key for key', () => {
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' && !('other' in v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
      )
    expect(keys(ro).sort()).toEqual(keys(en).sort())
  })

  it('shared words in both languages', () => {
    expect(sharedT('ro')('duration.hours', { count: 20 })).toBe('20 de ore')
    expect(sharedT('en')('trust.tier.Fair')).toBe('Fair')
    expect(sharedT('ro')('trust.tier.Fair')).toBe('Acceptabil')
  })
})

describe('validation messages', () => {
  it('quote the limits the rules actually use', async () => {
    const { AUTH } = await import('../constants/auth')
    const { BOOKING } = await import('../constants/booking')
    const { REVIEW } = await import('../constants/review')
    const { PITCH_LIMITS } = await import('../pitch-manage')
    const t = sharedT('en')
    expect(t('v.minAge')).toContain(String(AUTH.MIN_AGE_YEARS))
    expect(t('v.otpDigits')).toContain(String(AUTH.OTP_LENGTH))
    expect(t('v.bookingDuration')).toContain(
      `${BOOKING.MIN_DURATION_HOURS} and ${BOOKING.MAX_DURATION_HOURS}`
    )
    expect(t('v.reviewMinText')).toContain(String(REVIEW.MIN_TEXT_LENGTH))
    expect(t('v.nameMax')).toContain(String(PITCH_LIMITS.NAME_MAX))
  })

  it('t.text translates a key and leaves anything else alone', () => {
    expect(sharedT('ro').text('v.nothingToChange')).toBe('Nimic de modificat')
    expect(sharedT('ro').text('Some server sentence')).toBe('Some server sentence')
  })
})

describe('resolveLocale', () => {
  it('takes the first valid choice, else Romanian', () => {
    expect(resolveLocale(undefined, 'xx', 'en')).toBe('en')
    expect(resolveLocale(null)).toBe('ro')
  })
})
