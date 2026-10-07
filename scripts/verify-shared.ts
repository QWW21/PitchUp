import {
  RegisterPlayerSchema,
  LoginSchema,
  CreateBookingSchema,
  CreateReviewSchema,
  CreatePitchSchema,
  TRUST_SCORE_DELTAS,
  TRUST_TIERS,
  SHIRT_COLOURS,
  PLATFORM_FEE_PERCENT,
  CITIES,
  AUTH,
} from '../packages/shared/src/index'

let fail = 0
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`
  )
}

const player = (dob: string) =>
  RegisterPlayerSchema.safeParse({
    name: 'Ion Popescu',
    email: 'ion@example.ro',
    phone: '+40712345678',
    password: 'Parola123',
    city: 'Cluj-Napoca',
    dateOfBirth: dob,
  }).success

// Ticket acceptance: 1900-01-01 -> passes (old enough), 2009-01-01 -> passes.
check('age 1900-01-01 accepted', player('1900-01-01'), true)
check('age 2009-01-01 accepted (17y)', player('2009-01-01'), true)
check('age 2020-01-01 rejected (6y)', player('2020-01-01'), false)
const today = new Date()
const exactly16 = `${today.getUTCFullYear() - 16}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
check('exactly 16 today accepted', player(exactly16), true)
const d = new Date(
  Date.UTC(today.getUTCFullYear() - 16, today.getUTCMonth(), today.getUTCDate() + 1)
)
const dayShyOf16 = d.toISOString().slice(0, 10)
check('one day shy of 16 rejected', player(dayShyOf16), false)
check('future dob rejected', player('2099-01-01'), false)
check('garbage dob rejected', player('not-a-date'), false)

// Password policy PRD 6.1
const pw = (p: string) =>
  RegisterPlayerSchema.safeParse({
    name: 'Ion Popescu',
    email: 'i@e.ro',
    phone: '+40712345678',
    password: p,
    city: 'Cluj',
    dateOfBirth: '1990-01-01',
  }).success
check('password no uppercase rejected', pw('parola123'), false)
check('password no number rejected', pw('ParolaABC'), false)
check('password 7 chars rejected', pw('Parol1a'), false)
check('password valid accepted', pw('Parola123'), true)

// Phone E.164
const ph = (p: string) =>
  RegisterPlayerSchema.safeParse({
    name: 'Ion Popescu',
    email: 'i@e.ro',
    phone: p,
    password: 'Parola123',
    city: 'Cluj',
    dateOfBirth: '1990-01-01',
  }).success
check('phone without + rejected', ph('0712345678'), false)
check('phone E.164 accepted', ph('+40712345678'), true)

// Login must not leak password policy
check(
  'login accepts any non-empty password',
  LoginSchema.safeParse({ email: 'a@b.ro', password: 'x' }).success,
  true
)
check(
  'login rejects empty password',
  LoginSchema.safeParse({ email: 'a@b.ro', password: '' }).success,
  false
)

// Constants vs PRD 9.1 / 9.2 / 8
check('NO_SHOW delta -20', TRUST_SCORE_DELTAS.NO_SHOW, -20)
check('LATE_CANCEL delta -5', TRUST_SCORE_DELTAS.LATE_CANCEL, -5)
check('VERY_LATE_CANCEL delta -10', TRUST_SCORE_DELTAS.VERY_LATE_CANCEL, -10)
check('DISPUTE_WON delta +10', TRUST_SCORE_DELTAS.DISPUTE_WON, 10)
check('platform fee 8%', PLATFORM_FEE_PERCENT, 8)
check(
  'tiers cover 0-100 with no gaps',
  TRUST_TIERS.map(t => [t.min, t.max]),
  [
    [90, 100],
    [70, 89],
    [50, 69],
    [30, 49],
    [0, 29],
  ]
)
check('Suspended cannot book', TRUST_TIERS.find(t => t.label === 'Suspended')!.canBook, false)
check('shirt colours match UIUX 7.3', SHIRT_COLOURS, [
  'RED',
  'BLUE',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'WHITE',
  'BLACK',
  'PURPLE',
])
check('10 cities', CITIES.length, 10)
check('bcrypt cost 12', AUTH.BCRYPT_COST, 12)

// Booking rules PRD 15
const bk = (s: string, e: string) =>
  CreateBookingSchema.safeParse({
    pitchId: 'clh1234567890abcdefghijkl',
    startTime: s,
    endTime: e,
    teamCount: 2,
    teamsData: [{}, {}],
  }).success
check('1h booking accepted', bk('2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z'), true)
check('5h booking rejected (>max 4)', bk('2026-11-01T10:00:00Z', '2026-11-01T15:00:00Z'), false)
check('end before start rejected', bk('2026-11-01T12:00:00Z', '2026-11-01T11:00:00Z'), false)
check('spanning midnight rejected', bk('2026-11-01T23:00:00Z', '2026-11-02T01:00:00Z'), false)
check('ending exactly midnight accepted', bk('2026-11-01T23:00:00Z', '2026-11-02T00:00:00Z'), true)
check(
  'teamsData length must equal teamCount',
  CreateBookingSchema.safeParse({
    pitchId: 'clh1234567890abcdefghijkl',
    startTime: '2026-11-01T10:00:00Z',
    endTime: '2026-11-01T11:00:00Z',
    teamCount: 3,
    teamsData: [{}, {}],
  }).success,
  false
)

// Review: text optional (PRD 15)
check(
  'rating with no text accepted',
  CreateReviewSchema.safeParse({
    bookingId: 'clh1234567890abcdefghijkl',
    rating: 1,
  }).success,
  true
)
check(
  'rating 6 rejected',
  CreateReviewSchema.safeParse({
    bookingId: 'clh1234567890abcdefghijkl',
    rating: 6,
  }).success,
  false
)

// Pitch cross-field rules
const basePitch = {
  name: 'A',
  surfaceType: 'ARTIFICIAL_GRASS',
  size: 'FIVE_A_SIDE',
  offPeakRate: 60,
  peakRate: 80,
}
check(
  'hasShirts without price rejected',
  CreatePitchSchema.safeParse({ ...basePitch, hasShirts: true }).success,
  false
)
check(
  'hasShirts with price accepted',
  CreatePitchSchema.safeParse({ ...basePitch, hasShirts: true, shirtRentalPrice: 10 }).success,
  true
)
check(
  'min>max booking hours rejected',
  CreatePitchSchema.safeParse({ ...basePitch, minBookingHours: 4, maxBookingHours: 2 }).success,
  false
)
check(
  'old PitchSize 5V5 rejected',
  CreatePitchSchema.safeParse({ ...basePitch, size: '5V5' }).success,
  false
)

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`)
process.exit(fail === 0 ? 0 : 1)
