/**
 * Venue subscriptions — C-15. No commission; a venue is live only while
 * its subscription runs. Test provider throughout (no Stripe keys in E2E):
 * subscribing needs no card, the daily job bills when a period ends, and
 * the test hook makes the next bill pay or fail. Moving stored dates back
 * stands in for the clock, as elsewhere in these tests.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import {
  addDays,
  dayOfWeek,
  venueClock,
  type AdminStats,
  type CompanyListPage,
  type ManagerBilling,
} from '@pitchup/shared'
import { get, post, put } from '../support/api'
import { createPlayer, createVenue, db, uniqueEmail } from '../support/db'
import { E2E_BASE_URL, E2E_CRON_SECRET } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const DAY = 86_400_000
const contexts: APIRequestContext[] = []

async function context(email: string, password = 'Testing123') {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

/** An approved venue with one bookable pitch and no subscription, as after approval. */
async function newVenue() {
  const email = uniqueEmail('bill-mgr')
  const name = `Billing Arena ${Date.now().toString(36)}`
  const venue = await createVenue(email, name)
  await db.company.update({
    where: { id: venue.companyId },
    data: {
      subscriptionStatus: 'NONE',
      billingInterval: null,
      trialEndsAt: null,
      firstPaidAt: null,
      subscriptionPeriodEnd: null,
    },
  })
  const pitch = await db.pitch.create({
    data: {
      companyId: venue.companyId,
      name: 'Teren 1',
      surfaceType: 'ARTIFICIAL_GRASS',
      size: 'FIVE_A_SIDE',
      hourlyRate: 100,
      isActive: true,
    },
  })
  return { ...venue, name, pitchId: pitch.id, ctx: await context(email) }
}

const cron = (request: APIRequestContext) =>
  request.get('/api/v1/cron/billing', {
    headers: { Authorization: `Bearer ${E2E_CRON_SECRET}` },
  })

const listed = async (request: APIRequestContext, name: string) =>
  (
    await get<CompanyListPage>(
      request,
      `/companies?city=Cluj-Napoca&search=${encodeURIComponent(name)}`
    )
  ).data!.companies.length > 0

const today = venueClock(new Date()).date
const openDay = (n: number) => {
  let d = addDays(today, n)
  while (dayOfWeek(d) === 0) d = addDays(d, 1)
  return d
}

let player: APIRequestContext

test.beforeAll(async () => {
  const email = uniqueEmail('bill-p')
  await createPlayer(email)
  player = await context(email)
})

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'bill-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'bill-mgr-' } } } })
  for (const c of contexts) await c.dispose()
})

const book = (pitchId: string, n: number) =>
  post<{ bookingId: string; total: number }>(player, '/bookings', {
    pitchId,
    date: openDay(n),
    startTime: '10:00',
    endTime: '11:00',
    teamCount: 2,
    teamsData: [{}, {}],
  })

test('without a subscription a venue is hidden and takes no bookings', async ({ request }) => {
  const v = await newVenue()
  expect(await listed(request, v.name)).toBe(false)
  expect((await get(request, `/pitches/${v.pitchId}`)).status).toBe(404)
  const refused = await book(v.pitchId, 2)
  expect(refused.status).toBe(403)
  expect(refused.error?.details).toMatchObject({ reason: 'VENUE_PAUSED' })

  const billing = (await get<ManagerBilling>(v.ctx, '/manager/billing')).data!
  expect(billing).toMatchObject({
    status: 'NONE',
    trialAvailable: true,
    trialDays: 30,
    activePitches: 1,
    provider: 'test',
    nextBill: null,
  })
  expect(billing.prices.MONTHLY).toMatchObject({ total: 10, discounted: true })
  expect(billing.prices.YEARLY).toMatchObject({ total: 100, discounted: true })
})

test('the free month, then monthly bills, a failure, the grace and a pause', async ({
  request,
}) => {
  const v = await newVenue()

  // The free month: live at once, no card in test mode.
  const started = await post<{ billing: ManagerBilling }>(v.ctx, '/manager/billing/subscribe', {
    interval: 'MONTHLY',
  })
  expect(started.status).toBe(200)
  expect(started.data!.billing).toMatchObject({
    status: 'TRIALING',
    interval: 'MONTHLY',
    trialAvailable: false,
  })
  const trialDays = (new Date(started.data!.billing.trialEndsAt!).getTime() - Date.now()) / DAY
  expect(Math.round(trialDays)).toBe(30)
  expect(
    (await post(v.ctx, '/manager/billing/subscribe', { interval: 'MONTHLY' })).error?.details
  ).toMatchObject({ reason: 'ALREADY_SUBSCRIBED' })
  expect(await listed(request, v.name)).toBe(true)

  // C-15: the booking keeps no commission anywhere.
  const booked = await book(v.pitchId, 3)
  expect(booked.status).toBe(201)
  expect(booked.data!.total).toBe(100)
  expect(
    await db.booking.findUniqueOrThrow({ where: { id: booked.data!.bookingId } })
  ).not.toHaveProperty('platformFee')

  // The trial ends: the job bills the first discounted month.
  const trialEnd = new Date(Date.now() - 60_000)
  await db.company.update({
    where: { id: v.companyId },
    data: { trialEndsAt: trialEnd, subscriptionPeriodEnd: trialEnd },
  })
  expect((await cron(request)).status()).toBe(200)
  let billing = (await get<ManagerBilling>(v.ctx, '/manager/billing')).data!
  expect(billing.status).toBe('ACTIVE')
  expect(billing.invoices).toHaveLength(1)
  expect(billing.invoices[0]).toMatchObject({ amount: 10, interval: 'MONTHLY' })
  const company = await db.company.findUniqueOrThrow({ where: { id: v.companyId } })
  expect(company.firstPaidAt?.getTime()).toBe(trialEnd.getTime())

  // A failed bill: still live during the grace.
  billing = (
    await post<ManagerBilling>(v.ctx, '/payments/test/subscription', { outcome: 'failed' })
  ).data!
  expect(billing.status).toBe('PAST_DUE')
  expect(billing.pauseOn).not.toBeNull()
  expect(await listed(request, v.name)).toBe(true)
  const notice = await db.notification.findFirst({
    where: { user: { email: { startsWith: 'bill-mgr-' } }, type: 'SUBSCRIPTION_NOTICE' },
    orderBy: { createdAt: 'desc' },
  })
  expect(notice?.title).toBe('Your subscription payment failed')

  // Seven days later the job pauses the venue.
  await db.company.update({
    where: { id: v.companyId },
    data: { subscriptionPastDueSince: new Date(Date.now() - 8 * DAY) },
  })
  await cron(request)
  expect((await get<ManagerBilling>(v.ctx, '/manager/billing')).data!.status).toBe('PAUSED')
  expect(await listed(request, v.name)).toBe(false)
  expect((await book(v.pitchId, 4)).error?.details).toMatchObject({ reason: 'VENUE_PAUSED' })
  // The booking made before stays.
  expect(
    (await db.booking.findUniqueOrThrow({ where: { id: booked.data!.bookingId } })).status
  ).not.toBe('CANCELLED')

  // Paying brings it back at once, without an admin.
  billing = (await post<ManagerBilling>(v.ctx, '/payments/test/subscription', { outcome: 'paid' }))
    .data!
  expect(billing.status).toBe('ACTIVE')
  expect(billing.invoices).toHaveLength(2)
  expect(await listed(request, v.name)).toBe(true)
})

test('the price follows the year and the active pitches', async () => {
  const v = await newVenue()
  await post(v.ctx, '/manager/billing/subscribe', { interval: 'MONTHLY' })
  // Two more active pitches: one beyond the two included.
  await db.pitch.createMany({
    data: ['Teren 2', 'Teren 3'].map(name => ({
      companyId: v.companyId,
      name,
      surfaceType: 'ARTIFICIAL_GRASS' as const,
      size: 'FIVE_A_SIDE' as const,
      hourlyRate: 100,
      isActive: true,
    })),
  })
  let billing = (await get<ManagerBilling>(v.ctx, '/manager/billing')).data!
  expect(billing.activePitches).toBe(3)
  expect(billing.prices.MONTHLY).toMatchObject({ base: 10, extraPitches: 1, total: 15 })
  expect(billing.prices.YEARLY.total).toBe(150)

  // Thirteen months after the first paid month: the standard price.
  const now = Date.now()
  await db.company.update({
    where: { id: v.companyId },
    data: {
      subscriptionStatus: 'ACTIVE',
      firstPaidAt: new Date(now - 400 * DAY),
      subscriptionPeriodEnd: new Date(now + DAY),
    },
  })
  billing = (await get<ManagerBilling>(v.ctx, '/manager/billing')).data!
  expect(billing.prices.MONTHLY).toMatchObject({ total: 35, discounted: false })
  expect(billing.prices.YEARLY.total).toBe(350)

  // Yearly from the next bill.
  billing = (await put<ManagerBilling>(v.ctx, '/manager/billing/interval', { interval: 'YEARLY' }))
    .data!
  expect(billing).toMatchObject({ interval: 'YEARLY', nextBill: { total: 350 } })
})

test('cancelling runs to the end of the period, and can be undone', async ({ request }) => {
  const v = await newVenue()
  await post(v.ctx, '/manager/billing/subscribe', { interval: 'YEARLY' })
  let billing = (await post<ManagerBilling>(v.ctx, '/manager/billing/cancel', {})).data!
  expect(billing.status).toBe('CANCELLING')
  expect(await listed(request, v.name)).toBe(true)
  billing = (await post<ManagerBilling>(v.ctx, '/manager/billing/resume', {})).data!
  expect(billing.status).toBe('TRIALING')

  await post(v.ctx, '/manager/billing/cancel', {})
  await db.company.update({
    where: { id: v.companyId },
    data: { subscriptionPeriodEnd: new Date(Date.now() - 60_000) },
  })
  await cron(request)
  expect((await get<ManagerBilling>(v.ctx, '/manager/billing')).data!.status).toBe('PAUSED')
  // No second free month.
  billing = (
    await post<{ billing: ManagerBilling }>(v.ctx, '/manager/billing/subscribe', {
      interval: 'MONTHLY',
    })
  ).data!.billing
  expect(billing.status).toBe('ACTIVE')
  expect(billing.invoices[0]).toMatchObject({ amount: 10 })
})

test('the billing job and hook are locked down; admins see the revenue', async ({ request }) => {
  expect((await request.get('/api/v1/cron/billing')).status()).toBe(401)
  expect((await post(request, '/payments/test/subscription', { outcome: 'paid' })).status).toBe(401)
  expect((await get(player, '/manager/billing')).status).toBe(403)

  const admin = await context('admin@pitchup.ro', process.env.ADMIN_PASSWORD || 'Admin1234!')
  const stats = (await get<AdminStats>(admin, '/admin/stats')).data!
  expect(stats.revenue).toBeGreaterThanOrEqual(stats.last30dRevenue)
  expect(stats.subscriptions.TRIALING + stats.subscriptions.ACTIVE).toBeGreaterThan(0)
  expect(stats).not.toHaveProperty('fees')
})
