/**
 * PRD constants and the cross-field schema rules — ported from
 * scripts/verify-shared.ts (E01), so they run with every other unit test.
 */
import { describe, expect, it } from 'vitest'
import {
  AUTH,
  CITIES,
  CreateBookingSchema,
  CreatePitchSchema,
  CreateReviewSchema,
  LoginSchema,
  PLATFORM_FEE_PERCENT,
  RegisterPlayerSchema,
  SHIRT_COLOURS,
  shirtSetsFor,
  TRUST_SCORE_DELTAS,
  TRUST_TIERS,
} from './index'

const CUID = 'clh1234567890abcdefghijkl'

describe('constants match the PRD', () => {
  it('trust score deltas (§9.1)', () => {
    expect(TRUST_SCORE_DELTAS).toMatchObject({
      NO_SHOW: -20,
      LATE_CANCEL: -5,
      VERY_LATE_CANCEL: -10,
      DISPUTE_WON: 10,
    })
  })

  it('trust tiers cover 0–100 with no gaps, and Suspended cannot book (§9.2)', () => {
    expect(TRUST_TIERS.map(t => [t.min, t.max])).toEqual([
      [90, 100],
      [70, 89],
      [50, 69],
      [30, 49],
      [0, 29],
    ])
    expect(TRUST_TIERS.find(t => t.label === 'Suspended')?.canBook).toBe(false)
  })

  it('platform fee, cities, shirt colours and bcrypt cost', () => {
    expect(PLATFORM_FEE_PERCENT).toBe(8)
    expect(CITIES).toHaveLength(10)
    expect(SHIRT_COLOURS).toEqual([
      'RED',
      'BLUE',
      'GREEN',
      'YELLOW',
      'ORANGE',
      'WHITE',
      'BLACK',
      'PURPLE',
    ])
    expect(AUTH.BCRYPT_COST).toBe(12)
  })
})

describe('RegisterPlayerSchema date of birth', () => {
  const dob = (dateOfBirth: string) =>
    RegisterPlayerSchema.safeParse({
      name: 'Ion Popescu',
      email: 'ion@example.ro',
      phone: '+40712345678',
      password: 'Parola123',
      city: 'Cluj-Napoca',
      dateOfBirth,
    }).success

  it.each([
    ['1900-01-01', true],
    ['2009-01-01', true],
    ['2020-01-01', false],
    ['2099-01-01', false],
    ['not-a-date', false],
  ])('%s → %s', (value, ok) => {
    expect(dob(value)).toBe(ok)
  })
})

describe('LoginSchema', () => {
  it('accepts any non-empty password, so it does not reveal the policy', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.ro', password: 'x' }).success).toBe(true)
    expect(LoginSchema.safeParse({ email: 'a@b.ro', password: '' }).success).toBe(false)
  })
})

describe('CreateBookingSchema (PRD §15)', () => {
  const booking = (startTime: string, endTime: string, teamCount = 2, teams = 2) =>
    CreateBookingSchema.safeParse({
      pitchId: CUID,
      startTime,
      endTime,
      teamCount,
      teamsData: Array.from({ length: teams }, () => ({})),
    }).success

  it.each([
    ['one hour', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z', true],
    ['five hours (over the 4h maximum)', '2026-11-01T10:00:00Z', '2026-11-01T15:00:00Z', false],
    ['ending before it starts', '2026-11-01T12:00:00Z', '2026-11-01T11:00:00Z', false],
    ['spanning midnight', '2026-11-01T23:00:00Z', '2026-11-02T01:00:00Z', false],
    ['ending exactly at midnight', '2026-11-01T23:00:00Z', '2026-11-02T00:00:00Z', true],
  ])('%s', (_label, start, end, ok) => {
    expect(booking(start, end)).toBe(ok)
  })

  it('needs one teamsData entry per team', () => {
    expect(booking('2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z', 3, 2)).toBe(false)
  })
})

describe('CreateReviewSchema', () => {
  it('text is optional; the rating is 1–5', () => {
    expect(CreateReviewSchema.safeParse({ bookingId: CUID, rating: 1 }).success).toBe(true)
    expect(CreateReviewSchema.safeParse({ bookingId: CUID, rating: 6 }).success).toBe(false)
  })
})

describe('CreatePitchSchema', () => {
  const base = {
    name: 'A',
    surfaceType: 'ARTIFICIAL_GRASS',
    size: 'FIVE_A_SIDE',
    hourlyRate: 60,
  }
  const ok = (patch: Record<string, unknown>) =>
    CreatePitchSchema.safeParse({ ...base, ...patch }).success

  it('shirts are free: offering them needs no price', () => {
    expect(ok({ hasShirts: true })).toBe(true)
  })

  it('has one hourly rate and no peak pricing', () => {
    expect(ok({ hourlyRate: undefined })).toBe(false)
    const parsed = CreatePitchSchema.parse({ ...base, peakRate: 80 })
    expect(parsed).not.toHaveProperty('peakRate')
  })

  it('accepts 6v6', () => {
    expect(ok({ size: 'SIX_A_SIDE' })).toBe(true)
  })

  it('minimum booking hours cannot exceed the maximum', () => {
    expect(ok({ minBookingHours: 4, maxBookingHours: 2 })).toBe(false)
  })

  it('rejects the old size names', () => {
    expect(ok({ size: '5V5' })).toBe(false)
  })
})

describe('free shirts (one set per team but one)', () => {
  it.each([
    [2, true, 1],
    [3, true, 2],
    [2, false, 0],
    [3, false, 0],
  ])('%i teams, wants shirts %s → %i sets', (teams, wants, sets) => {
    expect(shirtSetsFor(teams, wants)).toBe(sets)
  })

  it('a booking asks yes or no, and defaults to no', () => {
    const booking = {
      pitchId: CUID,
      startTime: '2026-11-01T10:00:00Z',
      endTime: '2026-11-01T11:00:00Z',
      teamCount: 2,
      teamsData: [{ colour: 'RED' }, {}],
    }
    expect(CreateBookingSchema.parse(booking).wantsShirts).toBe(false)
    expect(CreateBookingSchema.parse({ ...booking, wantsShirts: true }).wantsShirts).toBe(true)
  })
})
