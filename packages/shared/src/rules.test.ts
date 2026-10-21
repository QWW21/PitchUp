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
  ManagerReplySchema,
  ManagerReviewQuerySchema,
  RegisterPlayerSchema,
  ReportReviewSchema,
  ReviewListQuerySchema,
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

  it('cities, shirt colours and bcrypt cost', () => {
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
  const booking = (
    startTime: string,
    endTime: string,
    teamCount = 2,
    teams = 2,
    date = '2026-11-01'
  ) =>
    CreateBookingSchema.safeParse({
      pitchId: CUID,
      date,
      startTime,
      endTime,
      teamCount,
      teamsData: Array.from({ length: teams }, () => ({})),
    }).success

  it.each([
    ['one hour', '10:00', '11:00', true],
    ['an hour and a half', '10:00', '11:30', true],
    ['five hours (over the 4h maximum)', '10:00', '15:00', false],
    ['half an hour (under the 1h minimum)', '10:00', '10:30', false],
    ['ending before it starts', '12:00', '11:00', false],
    ['off the half-hour grid', '10:15', '11:15', false],
    ['ending exactly at midnight', '23:00', '24:00', true],
    ['past midnight (it cannot span days)', '23:00', '25:00', false],
  ])('%s', (_label, start, end, ok) => {
    expect(booking(start, end)).toBe(ok)
  })

  it('needs one teamsData entry per team', () => {
    expect(booking('10:00', '11:00', 3, 2)).toBe(false)
  })

  it('needs a real date', () => {
    expect(booking('10:00', '11:00', 2, 2, '2026-02-31')).toBe(false)
    expect(booking('10:00', '11:00', 2, 2, '01/11/2026')).toBe(false)
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
      date: '2026-11-01',
      startTime: '10:00',
      endTime: '11:00',
      teamCount: 2,
      teamsData: [{ colour: 'RED' }, {}],
    }
    expect(CreateBookingSchema.parse(booking).wantsShirts).toBe(false)
    expect(CreateBookingSchema.parse({ ...booking, wantsShirts: true }).wantsShirts).toBe(true)
  })
})

describe('review text (E06-05)', () => {
  const review = (text?: string) =>
    CreateReviewSchema.safeParse({
      bookingId: CUID,
      rating: 4,
      ...(text !== undefined ? { text } : {}),
    })
  it('is optional, and blank counts as none', () => {
    expect(review().success).toBe(true)
    const blank = review('   ')
    expect(blank.success && blank.data.text).toBeUndefined()
  })
  it('needs at least ten characters when given', () => {
    expect(review('Too short').success).toBe(false) // 9
    expect(review('Just right').success).toBe(true) // 10
    expect(review('x'.repeat(501)).success).toBe(false)
  })
})

describe('review replies, reports and lists (E07)', () => {
  it('a reply is 1 to 300 characters (PRD §8.5)', () => {
    expect(ManagerReplySchema.safeParse({ reply: '  ' }).success).toBe(false)
    expect(ManagerReplySchema.safeParse({ reply: 'x'.repeat(300) }).success).toBe(true)
    expect(ManagerReplySchema.safeParse({ reply: 'x'.repeat(301) }).success).toBe(false)
  })
  it('a report has one of the PRD §11.3 categories; blank detail is none', () => {
    expect(ReportReviewSchema.safeParse({ category: 'SPAM' }).success).toBe(true)
    expect(ReportReviewSchema.safeParse({ category: 'RUDE' }).success).toBe(false)
    const blank = ReportReviewSchema.safeParse({ category: 'FAKE', detail: ' ' })
    expect(blank.success && blank.data.detail).toBeUndefined()
    expect(
      ReportReviewSchema.safeParse({ category: 'FAKE', detail: 'x'.repeat(301) }).success
    ).toBe(false)
  })
  it('lists default to newest, page 1, and refuse unknown orders', () => {
    expect(ReviewListQuerySchema.parse({})).toEqual({ sort: 'newest', page: 1, limit: 10 })
    expect(ReviewListQuerySchema.safeParse({ sort: 'best' }).success).toBe(false)
    expect(ReviewListQuerySchema.safeParse({ limit: '51' }).success).toBe(false)
    // Managers cannot sort by highest: it is not a question they need answered.
    expect(ManagerReviewQuerySchema.safeParse({ sort: 'highest' }).success).toBe(false)
    expect(ManagerReviewQuerySchema.parse({ sort: 'unanswered' })).toMatchObject({ limit: 20 })
  })
})
