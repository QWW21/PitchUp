/**
 * The trust engine — E12-01 … E12-06. Each test makes its own venue (open
 * 08:00–23:00, closed Sundays) and players, and reads the score and its
 * history straight from the database.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import { addDays, dayOfWeek, venueClock, type OpenDispute, type PitchDetail } from '@pitchup/shared'
import { get, post, put } from '../support/api'
import { createPlayer, createVenue, db, seedBooking, uniqueEmail } from '../support/db'
import { E2E_BASE_URL, E2E_CRON_SECRET } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const HOUR = 3_600_000
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'
const contexts: APIRequestContext[] = []

async function context(email: string, password = 'Testing123') {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

async function venue() {
  const email = uniqueEmail('trust-mgr')
  const v = await createVenue(email, `Trust Test ${Date.now().toString(36)}`)
  const pitch = await db.pitch.create({
    data: {
      companyId: v.companyId,
      name: 'Teren',
      surfaceType: 'FUTSAL',
      size: 'FIVE_A_SIDE',
      hourlyRate: 100,
    },
  })
  return { ...v, pitchId: pitch.id, ctx: await context(email) }
}

async function player(score = 100) {
  const email = uniqueEmail('trust-p')
  await createPlayer(email)
  const u = await db.user.update({
    where: { email },
    data: { trustScore: score },
    select: { id: true },
  })
  return { id: u.id, email, ctx: await context(email) }
}

const scoreOf = async (id: string) =>
  (await db.user.findUniqueOrThrow({ where: { id }, select: { trustScore: true } })).trustScore
const events = (userId: string, reason?: string) =>
  db.trustScoreEvent.findMany({
    where: { userId, ...(reason ? { reason: reason as 'NO_SHOW' } : {}) },
    orderBy: { createdAt: 'asc' },
  })
const cron = (request: APIRequestContext, job: string) =>
  request.get(`/api/v1/cron/${job}`, { headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` } })
const openDay = (n: number) => {
  let d = addDays(venueClock(new Date()).date, n)
  while (dayOfWeek(d) === 0) d = addDays(d, 1)
  return d
}

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'trust-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'trust-mgr-' } } } })
  for (const c of contexts) await c.dispose()
})

test.describe('completions (E12-02)', () => {
  test('+2 per completed game, at most +10 a month; the manual complete counts too', async ({
    request,
  }) => {
    const v = await venue()
    const p = await player(60)
    for (let i = 0; i < 6; i++) {
      await seedBooking({
        pitchId: v.pitchId,
        playerId: p.id,
        startsIn: -(3 + i * 3),
        status: 'CONFIRMED',
      })
    }
    expect((await cron(request, 'auto-complete')).status()).toBe(200)
    const earned = await events(p.id, 'BOOKING_COMPLETED')
    expect(earned).toHaveLength(5)
    expect(earned.every(e => e.delta === 2)).toBe(true)
    expect(await scoreOf(p.id)).toBe(70)

    // The cap is per player: another player still earns.
    const q = await player(80)
    const b = await seedBooking({
      pitchId: v.pitchId,
      playerId: q.id,
      startsIn: -3,
      status: 'CONFIRMED',
    })
    expect((await post(v.ctx, `/manager/bookings/${b.id}/complete`, {})).status).toBe(200)
    expect(await scoreOf(q.id)).toBe(82)
  })
})

test.describe('late cancellations (E12-03)', () => {
  test('−10 under 2 hours, −5 under 24, nothing earlier or for an unpaid checkout', async () => {
    const v = await venue()
    const p = await player(100)
    const cancel = async (startsIn: number, status: 'CONFIRMED' | 'PENDING' = 'CONFIRMED') => {
      const b = await seedBooking({
        pitchId: v.pitchId,
        playerId: p.id,
        startsIn,
        status,
        createdAgo: 0.01,
      })
      expect((await post(p.ctx, `/bookings/${b.id}/cancel`, {})).status).toBe(200)
    }
    await cancel(1)
    expect(await scoreOf(p.id)).toBe(90)
    await cancel(12)
    expect(await scoreOf(p.id)).toBe(85)
    await cancel(30)
    await cancel(1, 'PENDING')
    expect(await scoreOf(p.id)).toBe(85)
    expect((await events(p.id)).map(e => e.reason)).toEqual(['VERY_LATE_CANCEL', 'LATE_CANCEL'])
  })
})

test.describe('reviews (E12-05)', () => {
  test('+1 for reviewing a game, once', async () => {
    const v = await venue()
    const p = await player(90)
    const b = await seedBooking({
      pitchId: v.pitchId,
      playerId: p.id,
      startsIn: -30,
      status: 'COMPLETED',
    })
    const r = await post<{ id: string }>(p.ctx, '/reviews', {
      bookingId: b.id,
      rating: 5,
      isAnonymous: false,
    })
    expect(r.status).toBe(201)
    expect(await scoreOf(p.id)).toBe(91)
    expect(await events(p.id, 'REVIEW_LEFT')).toHaveLength(1)
  })
})

test.describe('the booking gate (E12-06, E12-09)', () => {
  test("a pitch's minimum, set by its manager, refuses lower tiers with both named", async ({
    request,
  }) => {
    const v = await venue()
    expect((await put(v.ctx, `/pitches/${v.pitchId}`, { minTrustScore: 55 })).status).toBe(400)
    expect((await put(v.ctx, `/pitches/${v.pitchId}`, { minTrustScore: 70 })).status).toBe(200)
    await db.pitch.update({ where: { id: v.pitchId }, data: { isActive: true } })
    expect((await get<PitchDetail>(request, `/pitches/${v.pitchId}`)).data?.minTrustScore).toBe(70)

    const body = {
      pitchId: v.pitchId,
      date: openDay(3),
      startTime: '18:00',
      endTime: '19:00',
      teamCount: 2,
      teamsData: [{}, {}],
    }
    const fair = await player(65)
    const refused = await post(fair.ctx, '/bookings', body)
    expect(refused.status).toBe(403)
    expect(refused.error?.details).toEqual({
      reason: 'TRUST_TIER_INSUFFICIENT',
      required: 'Good',
      current: 'Fair',
    })
    const good = await player(75)
    expect((await post(good.ctx, '/bookings', body)).status).toBe(201)
  })

  test('Poor players hold one upcoming booking; Suspended ones none', async () => {
    const v = await venue()
    await db.pitch.update({ where: { id: v.pitchId }, data: { isActive: true } })
    const body = (startTime: string, endTime: string) => ({
      pitchId: v.pitchId,
      date: openDay(4),
      startTime,
      endTime,
      teamCount: 2,
      teamsData: [{}, {}],
    })
    const poor = await player(40)
    await seedBooking({ pitchId: v.pitchId, playerId: poor.id, startsIn: 50, status: 'CONFIRMED' })
    const second = await post(poor.ctx, '/bookings', body('10:00', '11:00'))
    expect(second.error?.details).toEqual({ reason: 'ACTIVE_BOOKING_LIMIT' })

    const suspended = await player(20)
    const none = await post(suspended.ctx, '/bookings', body('12:00', '13:00'))
    expect(none.error?.details).toEqual({ reason: 'TRUST_SCORE_TOO_LOW' })
  })
})

test.describe('disputes (E12-04)', () => {
  test('the player was right: +10, the game counts as played; decided once', async () => {
    const v = await venue()
    const p = await player(100)
    const admin = await context('admin@pitchup.ro', ADMIN_PASSWORD)
    const b = await seedBooking({
      pitchId: v.pitchId,
      playerId: p.id,
      startsIn: -1,
      status: 'CONFIRMED',
    })
    expect(
      (await post(v.ctx, `/manager/bookings/${b.id}/no-show`, { reason: 'Nobody came' })).status
    ).toBe(200)
    expect(await scoreOf(p.id)).toBe(80)
    expect(
      (
        await post(p.ctx, `/bookings/${b.id}/dispute`, {
          disputeText: 'We played, the guard saw us at 18:00.',
        })
      ).status
    ).toBe(200)

    expect((await get(p.ctx, '/admin/disputes')).status).toBe(403)
    const open = (await get<OpenDispute[]>(admin, '/admin/disputes')).data!
    expect(open.find(d => d.bookingId === b.id)).toMatchObject({
      managerReason: 'Nobody came',
      disputeText: 'We played, the guard saw us at 18:00.',
    })
    const resolve = (outcome: string, note: string) =>
      put(admin, `/admin/disputes/${b.id}/resolve`, { outcome, note })
    expect((await resolve('RESOLVED_PLAYER', 'short')).status).toBe(400)
    expect((await resolve('RESOLVED_PLAYER', 'The venue confirmed the team played.')).status).toBe(
      200
    )
    expect(await scoreOf(p.id)).toBe(90)
    const after = await db.booking.findUniqueOrThrow({
      where: { id: b.id },
      include: { noShow: true },
    })
    expect(after.status).toBe('COMPLETED')
    expect(after.noShow?.disputeStatus).toBe('RESOLVED_PLAYER')
    expect((await resolve('RESOLVED_MANAGER', 'Changed my mind about this one.')).status).toBe(409)
    expect(await db.notification.count({ where: { userId: p.id, type: 'DISPUTE_RESOLVED' } })).toBe(
      1
    )
  })

  test('the venue was right: the no-show stands, no second penalty', async () => {
    const v = await venue()
    const p = await player(100)
    const admin = await context('admin@pitchup.ro', ADMIN_PASSWORD)
    const b = await seedBooking({
      pitchId: v.pitchId,
      playerId: p.id,
      startsIn: -1,
      status: 'CONFIRMED',
    })
    await post(v.ctx, `/manager/bookings/${b.id}/no-show`, {})
    await post(p.ctx, `/bookings/${b.id}/dispute`, {
      disputeText: 'I was there, honestly, ask anyone.',
    })
    expect(
      (
        await put(admin, `/admin/disputes/${b.id}/resolve`, {
          outcome: 'RESOLVED_MANAGER',
          note: 'CCTV shows nobody arrived.',
        })
      ).status
    ).toBe(200)
    expect(await scoreOf(p.id)).toBe(80)
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('NO_SHOW')
  })
})

test.describe('the monthly job (E12-05)', () => {
  test('needs the token; +1 recovery once a month; drifted scores are rebuilt from history', async ({
    request,
  }) => {
    expect((await request.get('/api/v1/cron/trust-monthly')).status()).toBe(401)

    // Lost 20 two months ago, nothing negative since: recovers 1.
    const p = await player(80)
    const longAgo = new Date(Date.now() - 70 * 24 * HOUR)
    await db.user.update({ where: { id: p.id }, data: { createdAt: longAgo } })
    await db.trustScoreEvent.create({
      data: { userId: p.id, delta: -20, reason: 'NO_SHOW', createdAt: longAgo },
    })
    // Its score was edited by hand: history says 100.
    const drifted = await player(40)

    expect((await cron(request, 'trust-monthly')).status()).toBe(200)
    expect(await scoreOf(p.id)).toBe(81)
    expect(await events(p.id, 'MONTHLY_RECOVERY')).toHaveLength(1)
    expect(await scoreOf(drifted.id)).toBe(100)

    // Run again this month: no second recovery.
    await cron(request, 'trust-monthly')
    expect(await scoreOf(p.id)).toBe(81)
  })
})
