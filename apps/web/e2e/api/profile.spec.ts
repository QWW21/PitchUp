/**
 * Profile and account API — E08-01 (profile), E08-02 (trust score), E08-03
 * (password, deletion), E08-09 (notifications) and E08-10 (device tokens).
 * Each test signs in a fresh player.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import type { NotificationPage, Profile, ReviewPage, TrustScoreDetail } from '@pitchup/shared'
import { del, get, post, put } from '../support/api'
import {
  createPlayer,
  db,
  seedBooking,
  setVerificationCode,
  uniqueEmail,
  uniquePhone,
  venue,
} from '../support/db'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const HOUR = 3_600_000
const PASSWORD = 'Testing123'
const contexts: APIRequestContext[] = []

let api: APIRequestContext
let me: { id: string; email: string }

async function newPlayer() {
  const email = uniqueEmail('prof')
  await createPlayer(email)
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, PASSWORD)
  const user = await db.user.findUniqueOrThrow({ where: { email } })
  return { ctx, id: user.id, email }
}

const patch = (r: APIRequestContext, path: string) => r.patch(`/api/v1${path}`)

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
  const p = await newPlayer()
  api = p.ctx
  me = { id: p.id, email: p.email }
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'prof-' } } } })
  for (const c of contexts) await c.dispose()
})

test.describe('the profile (E08-01)', () => {
  test('shows the account without anything secret, and needs a session', async ({ request }) => {
    const r = await get<Profile>(api, '/profile')
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({
      id: me.id,
      email: me.email,
      role: 'PLAYER',
      trustScore: 100,
      trustTier: 'Excellent',
      avatarUrl: null,
    })
    const keys = Object.keys(r.data!)
    for (const secret of ['passwordHash', 'stripeCustomerId', 'refreshTokens', 'deletedAt']) {
      expect(keys).not.toContain(secret)
    }
    expect((await get(request, '/profile')).status).toBe(401)
  })

  test('updates some fields; email and role are not for changing here', async () => {
    const r = await put<Profile>(api, '/profile', {
      name: 'Ioana Updated',
      city: 'Iași',
      email: 'someone-else@e2e.test',
      role: 'ADMIN',
    })
    expect(r.status).toBe(200)
    expect(r.data).toMatchObject({
      name: 'Ioana Updated',
      city: 'Iași',
      email: me.email,
      role: 'PLAYER',
    })

    expect((await put(api, '/profile', { city: 'Atlantis' })).status).toBe(400)
    expect((await put(api, '/profile', { avatarUrl: 'https://evil.example/me.png' })).status).toBe(
      400
    )
    expect((await put(api, '/profile', {})).status).toBe(400)

    const photo = 'https://res.cloudinary.com/demo/image/upload/v1/pitchup/users/me.jpg'
    expect((await put<Profile>(api, '/profile', { avatarUrl: photo })).data!.avatarUrl).toBe(photo)
    expect((await put<Profile>(api, '/profile', { avatarUrl: null })).data!.avatarUrl).toBeNull()
  })

  test('a new phone number has to be verified again, and cannot be someone else’s', async () => {
    const phone = uniquePhone()
    const r = await put<Profile>(api, '/profile', { phone })
    expect(r.data).toMatchObject({ phone, phoneVerified: false })

    const other = await newPlayer()
    const taken = await put(other.ctx, '/profile', { phone })
    expect(taken.status).toBe(409)
    expect(taken.error?.details).toEqual({ reason: 'PHONE_TAKEN' })
  })
})

test.describe('the trust score (E08-02)', () => {
  test('score, tier, history newest first in pages, and every tier', async () => {
    const g = await venue('gheorgheni')
    const b = await seedBooking({
      pitchId: g.pitches[1]!.id,
      playerId: me.id,
      startsIn: -30,
      status: 'COMPLETED',
    })
    const at = (h: number) => new Date(Date.now() - h * HOUR)
    await db.trustScoreEvent.createMany({
      data: [
        {
          userId: me.id,
          delta: 2,
          reason: 'BOOKING_COMPLETED',
          relatedBookingId: b.id,
          createdAt: at(30),
        },
        { userId: me.id, delta: -5, reason: 'LATE_CANCEL', createdAt: at(20) },
        { userId: me.id, delta: 1, reason: 'MONTHLY_RECOVERY', createdAt: at(10) },
      ],
    })
    await db.user.update({ where: { id: me.id }, data: { trustScore: 78 } })

    const first = (await get<TrustScoreDetail>(api, '/profile/trust-score?limit=2')).data!
    expect(first).toMatchObject({
      score: 78,
      tier: 'Good',
      tierDescription: 'No restrictions.',
      canBook: true,
      hasMore: true,
    })
    expect(first.events.map(e => [e.reason, e.delta, e.label])).toEqual([
      ['MONTHLY_RECOVERY', 1, 'Monthly recovery'],
      ['LATE_CANCEL', -5, 'Late cancellation'],
    ])
    expect(first.tiers.map(t => [t.name, t.range])).toEqual([
      ['Excellent', '90–100'],
      ['Good', '70–89'],
      ['Fair', '50–69'],
      ['Poor', '30–49'],
      ['Suspended', '< 30'],
    ])

    const second = (
      await get<TrustScoreDetail>(api, `/profile/trust-score?limit=2&cursor=${first.nextCursor}`)
    ).data!
    expect(second.events).toMatchObject([{ reason: 'BOOKING_COMPLETED', bookingId: b.id }])
    expect(second.hasMore).toBe(false)
  })

  test('30 is Poor, 29 is Suspended', async () => {
    await db.user.update({ where: { id: me.id }, data: { trustScore: 30 } })
    expect((await get<TrustScoreDetail>(api, '/profile/trust-score')).data).toMatchObject({
      tier: 'Poor',
      canBook: true,
      maxActiveBookings: 1,
      requiresUpfrontDeposit: true,
    })
    await db.user.update({ where: { id: me.id }, data: { trustScore: 29 } })
    expect((await get<TrustScoreDetail>(api, '/profile/trust-score')).data).toMatchObject({
      tier: 'Suspended',
      canBook: false,
    })
  })
})

test.describe('changing the password (E08-03)', () => {
  test('needs the current one; then every session ends', async ({ request }) => {
    // A phone session too, to see its refresh token revoked.
    const mobile = await post<{ refreshToken: string }>(request, '/auth/mobile/login', {
      email: me.email,
      password: PASSWORD,
    })
    expect(mobile.status).toBe(200)

    const wrong = await post(api, '/profile/change-password', {
      currentPassword: 'NotMyPass1',
      newPassword: 'BrandNew123',
    })
    expect(wrong.status).toBe(400)
    expect(wrong.error?.details).toEqual({ reason: 'WRONG_PASSWORD' })
    const weak = await post(api, '/profile/change-password', {
      currentPassword: PASSWORD,
      newPassword: 'short',
    })
    expect(weak.status).toBe(400)

    const r = await post(api, '/profile/change-password', {
      currentPassword: PASSWORD,
      newPassword: 'BrandNew123',
    })
    expect(r.status).toBe(200)
    // This browser's session is over, and so is the phone's.
    expect((await get(api, '/profile')).status).toBe(401)
    const refreshed = await post(request, '/auth/mobile/refresh', {
      refreshToken: mobile.data!.refreshToken,
    })
    expect(refreshed.status).toBe(401)

    const fresh = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
    contexts.push(fresh)
    await expect(signInApi(fresh, me.email, PASSWORD)).rejects.toThrow()
    await signInApi(fresh, me.email, 'BrandNew123')
    expect((await get(fresh, '/profile')).status).toBe(200)
  })

  test('five wrong tries in 15 minutes, then a pause', async () => {
    const attempt = () =>
      post(api, '/profile/change-password', {
        currentPassword: 'Wrong1234',
        newPassword: 'BrandNew123',
      })
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(400)
    expect((await attempt()).status).toBe(429)
  })
})

test.describe('deleting the account (E08-03)', () => {
  test('anonymises the player, refunds upcoming bookings in full, keeps reviews', async () => {
    const g = await venue('gheorgheni')
    const pitchId = g.pitches[1]!.id
    // Five hours ahead would normally refund half: deletion refunds all of it.
    const upcoming = await seedBooking({
      pitchId,
      playerId: me.id,
      startsIn: 5,
      status: 'CONFIRMED',
    })
    const played = await seedBooking({
      pitchId,
      playerId: me.id,
      startsIn: -30,
      status: 'COMPLETED',
    })
    const review = await db.review.create({
      data: {
        bookingId: played.id,
        pitchId,
        playerId: me.id,
        rating: 4,
        text: 'Solid pitch, will return.',
      },
    })

    const wrong = await del(api, '/profile', { password: 'NotMyPass1' })
    expect(wrong.error?.details).toEqual({ reason: 'WRONG_PASSWORD' })
    expect((await db.user.findUniqueOrThrow({ where: { id: me.id } })).deletedAt).toBeNull()

    const r = await del(api, '/profile', { password: PASSWORD, reason: 'Moving abroad' })
    expect(r.status).toBe(200)

    const user = await db.user.findUniqueOrThrow({ where: { id: me.id } })
    expect(user).toMatchObject({
      name: 'Former player',
      email: `deleted_${me.id}@pitchup.deleted`,
      profilePhotoUrl: null,
      city: null,
      deletionReason: 'Moving abroad',
    })
    expect(user.deletedAt).not.toBeNull()

    const cancelled = await db.booking.findUniqueOrThrow({ where: { id: upcoming.id } })
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancellationReason: 'Account deleted' })
    expect(Number(cancelled.refundAmount)).toBe(Number(cancelled.totalAmount))
    expect((await db.booking.findUniqueOrThrow({ where: { id: played.id } })).status).toBe(
      'COMPLETED'
    )

    const page = (await get<ReviewPage>(api, `/reviews?pitchId=${pitchId}&limit=50`)).data!
    expect(page.reviews.find(rv => rv.id === review.id)).toMatchObject({
      playerName: 'Former player',
      text: 'Solid pitch, will return.',
    })

    // Gone: this session, and any sign-in, old email or new.
    expect((await get(api, '/profile')).status).toBe(401)
    const fresh = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
    contexts.push(fresh)
    await expect(signInApi(fresh, me.email, PASSWORD)).rejects.toThrow()
  })

  test('venue managers close their account through support', async () => {
    const manager = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
    contexts.push(manager)
    await signInApi(manager, 'venue-manastur@demo.ro', 'Player1234!')
    const r = await del(manager, '/profile', { password: 'Player1234!' })
    expect(r.error?.details).toEqual({ reason: 'NOT_A_PLAYER' })
  })
})

test.describe('notifications (E08-09, E08-10)', () => {
  test('newest first with the unread count; read, read all, delete; only your own', async () => {
    const at = (h: number) => new Date(Date.now() - h * HOUR)
    await db.notification.createMany({
      data: [
        {
          userId: me.id,
          type: 'BOOKING_CONFIRMED',
          title: 'Booked',
          body: 'Teren 2',
          data: { bookingId: 'b1' },
          createdAt: at(3),
        },
        {
          userId: me.id,
          type: 'MANAGER_REPLIED',
          title: 'Replied',
          body: 'Arena',
          data: { reviewId: 'r1' },
          createdAt: at(2),
        },
        {
          userId: me.id,
          type: 'REFUND_PROCESSED',
          title: 'Refund',
          body: '180 RON',
          createdAt: at(1),
        },
      ],
    })
    const first = (await get<NotificationPage>(api, '/notifications?limit=2')).data!
    expect(first.items.map(n => n.title)).toEqual(['Refund', 'Replied'])
    expect(first).toMatchObject({ unread: 3, hasMore: true })
    const rest = (await get<NotificationPage>(api, `/notifications?cursor=${first.nextCursor}`))
      .data!
    expect(rest.items).toMatchObject([
      { title: 'Booked', data: { bookingId: 'b1' }, isRead: false },
    ])

    expect((await patch(api, `/notifications/${first.items[0]!.id}/read`)).status()).toBe(200)
    expect((await get<NotificationPage>(api, '/notifications')).data!.unread).toBe(2)

    const other = await newPlayer()
    expect((await patch(other.ctx, `/notifications/${first.items[1]!.id}/read`)).status()).toBe(404)
    expect((await del(other.ctx, `/notifications/${first.items[1]!.id}`)).status).toBe(404)

    const all = await patch(api, '/notifications/read-all')
    expect((await all.json()).data).toEqual({ updated: 2 })
    expect((await del(api, `/notifications/${first.items[1]!.id}`)).status).toBe(204)
    const after = (await get<NotificationPage>(api, '/notifications')).data!
    expect(after).toMatchObject({ unread: 0 })
    expect(after.items).toHaveLength(2)
  })

  test('a device token is stored once and follows whoever signs in on that phone', async () => {
    const token = `fcm-${Date.now()}-${'x'.repeat(40)}`
    expect(
      (await post(api, '/notifications/device-token', { token, platform: 'android' })).status
    ).toBe(200)
    expect(
      (await post(api, '/notifications/device-token', { token, platform: 'android' })).status
    ).toBe(200)
    expect(await db.deviceToken.count({ where: { token } })).toBe(1)

    const other = await newPlayer()
    await post(other.ctx, '/notifications/device-token', { token, platform: 'android' })
    expect((await db.deviceToken.findUniqueOrThrow({ where: { token } })).userId).toBe(other.id)

    expect(
      (await post(api, '/notifications/device-token', { token, platform: 'windows' })).status
    ).toBe(400)
  })
})

test.describe('verifying the phone (#163)', () => {
  test('needs a session', async ({ request }) => {
    expect((await post(request, '/profile/phone/code', {})).status).toBe(401)
    expect((await post(request, '/profile/phone/verify', { code: '123456' })).status).toBe(401)
  })

  test('texts a code on request, takes it once, then has nothing left to do', async () => {
    const sent = await post(api, '/profile/phone/code', {})
    expect(sent.status).toBe(200)
    expect(sent.data).toEqual({ sent: true })
    expect(
      await db.verificationCode.count({ where: { userId: me.id, channel: 'PHONE', usedAt: null } })
    ).toBe(1)

    // The texted code is only stored hashed; put a known one in its place.
    await setVerificationCode(me.email, '112233', 'PHONE')
    const wrong = await post(api, '/profile/phone/verify', { code: '000000' })
    expect(wrong.status).toBe(400)
    expect(wrong.error?.details).toEqual({ reason: 'INVALID_CODE', attemptsRemaining: 2 })
    expect((await post(api, '/profile/phone/verify', { code: '12' })).status).toBe(400)

    const right = await post(api, '/profile/phone/verify', { code: '112233' })
    expect(right.status).toBe(200)
    expect((await get<Profile>(api, '/profile')).data?.phoneVerified).toBe(true)

    const again = await post(api, '/profile/phone/code', {})
    expect(again.status).toBe(409)
    expect(again.error?.details).toEqual({ reason: 'ALREADY_VERIFIED' })
  })

  test('an expired code answers 410', async () => {
    await setVerificationCode(me.email, '445566', 'PHONE')
    await db.verificationCode.updateMany({
      where: { userId: me.id, channel: 'PHONE', usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const r = await post(api, '/profile/phone/verify', { code: '445566' })
    expect(r.status).toBe(410)
  })
})
