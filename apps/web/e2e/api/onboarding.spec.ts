/**
 * Manager onboarding and approval API — E09-01 … E09-05 and E09-10's stats,
 * plus the admin approval agreed for E09. Each test signs in a fresh manager
 * with no company. Stripe isn't configured in E2E, so step 4 uses the
 * built-in test account.
 */
import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from '@playwright/test'
import {
  DEFAULT_ONBOARDING_HOURS,
  type ManagerStats,
  type OnboardingStatus,
  type PendingCompany,
} from '@pitchup/shared'
import { get, post, put } from '../support/api'
import { createManager, createPlayer, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signInApi } from '../support/helpers'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'
const contexts: APIRequestContext[] = []

async function context(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL })
  contexts.push(ctx)
  await signInApi(ctx, email, password)
  return ctx
}

async function newManager() {
  const email = uniqueEmail('onb')
  const id = await createManager(email)
  return { ctx: await context(email, 'Testing123'), id, email }
}

const INFO = { name: 'Arena Test Onboarding', description: 'Two floodlit pitches.' }
const LOCATION = {
  addressLine1: 'Str. Sportului 1',
  city: 'Cluj-Napoca',
  county: 'Cluj',
  postalCode: '400001',
  lat: 46.7712,
  lng: 23.6236,
}
const CONTACT = {
  phone: '+40712000111',
  email: 'hello@arena-test.ro',
  workingHours: DEFAULT_ONBOARDING_HOURS,
}

/** Steps 1–3 done, ready for payouts. */
async function throughStep3(ctx: APIRequestContext) {
  expect((await post(ctx, '/onboarding/company', INFO)).status).toBe(201)
  expect((await put(ctx, '/onboarding/location', LOCATION)).status).toBe(200)
  expect((await put(ctx, '/onboarding/contact-hours', CONTACT)).status).toBe(200)
}

/** Step 4 in test mode: the link is our own return URL, which submits the venue. */
async function submit(ctx: APIRequestContext) {
  const r = await post<{ url: string }>(ctx, '/onboarding/stripe-connect', {})
  expect(r.status).toBe(200)
  expect(r.data!.url).toMatch(/\/api\/v1\/onboarding\/stripe-connect\/return$/)
  const back = await ctx.get(r.data!.url, { maxRedirects: 0 })
  expect(back.status()).toBe(307)
  return back.headers()['location']
}

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.afterAll(async () => {
  const owners = { owner: { email: { startsWith: 'onb-' } } }
  await db.company.deleteMany({ where: owners })
  for (const c of contexts) await c.dispose()
})

test.describe('who may onboard', () => {
  test('signed out: 401; a player: 403', async ({ request }) => {
    expect((await post(request, '/onboarding/company', INFO)).status).toBe(401)
    const email = uniqueEmail('onb-player')
    await createPlayer(email)
    const player = await context(email, 'Testing123')
    expect((await post(player, '/onboarding/company', INFO)).status).toBe(403)
    expect((await get(player, '/onboarding/status')).status).toBe(403)
  })
})

test.describe('the four steps (E09-01 … E09-05)', () => {
  test('status follows each step, one company per manager, then submitted for review', async () => {
    const m = await newManager()
    const status = async () => (await get<OnboardingStatus>(m.ctx, '/onboarding/status')).data!

    expect(await status()).toMatchObject({ companyId: null, currentStep: 1, completedSteps: [] })

    expect((await post(m.ctx, '/onboarding/company', { name: 'A' })).status).toBe(400)
    const created = await post<{ id: string }>(m.ctx, '/onboarding/company', {
      ...INFO,
      websiteUrl: '',
      instagramUrl: 'https://instagram.com/arenatest',
    })
    expect(created.status).toBe(201)
    const twice = await post(m.ctx, '/onboarding/company', INFO)
    expect(twice.status).toBe(409)
    expect(twice.error?.details).toEqual({ reason: 'COMPANY_EXISTS' })
    const company = await db.company.findUniqueOrThrow({ where: { id: created.data!.id } })
    expect(company).toMatchObject({
      status: 'DRAFT',
      websiteUrl: null,
      instagramUrl: 'https://instagram.com/arenatest',
    })
    expect(await status()).toMatchObject({ currentStep: 2, completedSteps: ['info'] })

    // Payouts before the address and hours: refused.
    const early = await post(m.ctx, '/onboarding/stripe-connect', {})
    expect(early.error?.details).toMatchObject({ reason: 'STEPS_INCOMPLETE' })

    expect(
      (await put(m.ctx, '/onboarding/location', { ...LOCATION, city: 'Atlantis' })).status
    ).toBe(400)
    const loc = await put<{ geocoded: boolean; lat: number }>(
      m.ctx,
      '/onboarding/location',
      LOCATION
    )
    expect(loc.data).toMatchObject({ geocoded: true, lat: 46.7712 })
    expect(await status()).toMatchObject({ currentStep: 3 })

    const sixDays = { ...CONTACT, workingHours: DEFAULT_ONBOARDING_HOURS.slice(0, 6) }
    expect((await put(m.ctx, '/onboarding/contact-hours', sixDays)).status).toBe(400)
    const allClosed = {
      ...CONTACT,
      workingHours: DEFAULT_ONBOARDING_HOURS.map(d => ({ ...d, isClosed: true })),
    }
    expect((await put(m.ctx, '/onboarding/contact-hours', allClosed)).status).toBe(400)
    const zeroLength = {
      ...CONTACT,
      workingHours: DEFAULT_ONBOARDING_HOURS.map(d =>
        d.day === 1 ? { ...d, closeTime: d.openTime } : d
      ),
    }
    expect((await put(m.ctx, '/onboarding/contact-hours', zeroLength)).status).toBe(400)
    // Closing after midnight is allowed.
    const lateNight = {
      ...CONTACT,
      workingHours: DEFAULT_ONBOARDING_HOURS.map(d =>
        d.day === 5 ? { ...d, closeTime: '02:00' } : d
      ),
    }
    expect((await put(m.ctx, '/onboarding/contact-hours', lateNight)).status).toBe(200)
    expect(await status()).toMatchObject({ currentStep: 4, stripeConnected: false })

    expect(await submit(m.ctx)).toMatch(/\/onboarding\/pending$/)
    const after = await db.company.findUniqueOrThrow({ where: { id: created.data!.id } })
    expect(after.status).toBe('PENDING')
    expect(after.stripeAccountId).toMatch(/^test_acct_/)
    expect(after.submittedAt).not.toBeNull()
    expect(await status()).toMatchObject({ currentStep: null, companyStatus: 'PENDING' })
    const told = await db.notification.count({
      where: { type: 'COMPANY_SUBMITTED', data: { equals: { companyId: after.id } } },
    })
    expect(told).toBeGreaterThan(0)
    // Not public yet.
    expect((await get(m.ctx, `/companies/${after.id}`)).status).toBe(404)
  })

  test('an address saved without a pin and no server key is kept, without coordinates', async () => {
    const m = await newManager()
    await post(m.ctx, '/onboarding/company', INFO)
    const { lat: _lat, lng: _lng, ...noPin } = LOCATION
    const r = await put<{ geocoded: boolean; lat: number | null }>(
      m.ctx,
      '/onboarding/location',
      noPin
    )
    expect(r.data).toMatchObject({ geocoded: false, lat: null })
    expect(
      (await get<OnboardingStatus>(m.ctx, '/onboarding/status')).data!.completedSteps
    ).toContain('location')
  })
})

test.describe('approval (admin, agreed for E09)', () => {
  test('approve makes it public and tells the manager; send back returns it to DRAFT with the reason', async () => {
    const admin = await context('admin@pitchup.ro', ADMIN_PASSWORD)
    const a = await newManager()
    const b = await newManager()
    for (const m of [a, b]) {
      await throughStep3(m.ctx)
      await submit(m.ctx)
    }
    const companyOf = (id: string) => db.company.findUniqueOrThrow({ where: { ownerId: id } })
    const [ca, cb] = [await companyOf(a.id), await companyOf(b.id)]

    // Managers and players can't see or decide.
    expect((await get(a.ctx, '/admin/companies')).status).toBe(403)
    expect((await post(a.ctx, `/admin/companies/${ca.id}/approve`, {})).status).toBe(403)

    const pending = (await get<PendingCompany[]>(admin, '/admin/companies')).data!
    expect(pending.map(c => c.id)).toEqual(expect.arrayContaining([ca.id, cb.id]))
    expect(pending.find(c => c.id === ca.id)).toMatchObject({
      name: INFO.name,
      city: 'Cluj-Napoca',
      stripeConnected: true,
      manager: { email: a.email },
    })

    expect((await post(admin, `/admin/companies/${ca.id}/approve`, {})).status).toBe(200)
    expect((await companyOf(a.id)).status).toBe('ACTIVE')
    expect(await db.notification.count({ where: { userId: a.id, type: 'COMPANY_APPROVED' } })).toBe(
      1
    )
    expect((await get(a.ctx, `/companies/${ca.id}`)).status).toBe(200)
    const again = await post(admin, `/admin/companies/${ca.id}/approve`, {})
    expect(again.error?.details).toEqual({ reason: 'NOT_PENDING' })

    expect((await post(admin, `/admin/companies/${cb.id}/reject`, { reason: 'x' })).status).toBe(
      400
    )
    const reason = 'Add a photo of the pitch entrance to your logo.'
    expect((await post(admin, `/admin/companies/${cb.id}/reject`, { reason })).status).toBe(200)
    expect(await companyOf(b.id)).toMatchObject({ status: 'DRAFT', rejectionReason: reason })
    expect((await get<OnboardingStatus>(b.ctx, '/onboarding/status')).data).toMatchObject({
      companyStatus: 'DRAFT',
      currentStep: 4,
      rejectionReason: reason,
    })
    // Fixed and sent again: pending, reason cleared.
    expect(await submit(b.ctx)).toMatch(/\/onboarding\/pending$/)
    expect(await companyOf(b.id)).toMatchObject({ status: 'PENDING', rejectionReason: null })
  })
})

test.describe("the manager's numbers (E09-10)", () => {
  test("today's bookings and revenue for an approved venue; refused before approval", async () => {
    const manager = await context('venue-gheorgheni@demo.ro', 'Player1234!')
    const g = await venue('gheorgheni')
    const before = (await get<ManagerStats>(manager, '/manager/stats/today')).data!
    expect(before).toMatchObject({
      revenueToday: expect.any(Number),
      bookingsToday: expect.any(Number),
      occupancyRate: expect.any(Number),
      noShowsThisWeek: expect.any(Number),
    })

    const email = uniqueEmail('onb-stats')
    await createPlayer(email)
    const player = await db.user.findUniqueOrThrow({ where: { email } })
    // Two hours from now, if that is still today in Bucharest; tomorrow's
    // bookings still show among the next ten.
    const b = await seedBooking({
      pitchId: g.pitches[1]!.id,
      playerId: player.id,
      startsIn: 2,
      status: 'CONFIRMED',
    })
    const after = (await get<ManagerStats>(manager, '/manager/stats/today')).data!
    expect(after.upcoming.map(u => u.id)).toContain(b.id)
    expect(after.upcoming.find(u => u.id === b.id)).toMatchObject({
      player: 'Second Player',
      status: 'CONFIRMED',
    })
    await db.booking.delete({ where: { id: b.id } })

    const m = await newManager()
    const refused = await get(m.ctx, '/manager/stats/today')
    expect(refused.error?.details).toEqual({ reason: 'NOT_ACTIVE' })
  })
})
