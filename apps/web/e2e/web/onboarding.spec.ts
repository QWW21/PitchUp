/**
 * Manager onboarding in a real browser — E09-06 … E09-09, the admin approval
 * agreed for E09, and the manager shell (E09-10). Each test signs in a fresh
 * manager with no company. Stripe isn't configured in E2E, so "Connect with
 * Stripe" uses the built-in test account. Screenshots go to
 * docs/test-evidence/web/onboarding.
 */
import { expect, test, type Page } from '@playwright/test'
import { createManager, db, uniqueEmail } from '../support/db'
import { PHONE, resetRateLimits, signIn, signOut, snap } from '../support/helpers'

const AREA = 'onboarding'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'

async function asNewManager(page: Page) {
  const email = uniqueEmail('web-onb')
  const id = await createManager(email)
  await signIn(page, email, 'Testing123')
  return { id, email }
}

/** A name no other run has used: company names are unique. */
const venueName = () => `Arena ${Date.now().toString(36)}`

async function fillStep1(page: Page, name: string) {
  await page.getByLabel('Company name').fill(name)
  await page.getByLabel(/Description/).fill('Two floodlit 7-a-side pitches near the centre.')
  await page.getByRole('button', { name: 'Next: location' }).click()
  await expect(page).toHaveURL(/\/onboarding\/step\/2$/)
}

async function fillStep2(page: Page) {
  await page.getByLabel('Address', { exact: true }).fill('Str. Sportului 1')
  await page.getByLabel('City').selectOption('Cluj-Napoca')
  await page.getByLabel('Postal code').fill('400001')
  await page.getByLabel('County').fill('Cluj')
  await page.getByRole('button', { name: 'Next: contact & hours' }).click()
  await expect(page).toHaveURL(/\/onboarding\/step\/3$/)
}

async function fillStep3(page: Page) {
  await page.getByLabel('Phone').fill('+40712000222')
  await page.getByLabel('Email').fill('hello@arena-web.ro')
  await page.getByRole('button', { name: 'Next: payouts' }).click()
  await expect(page).toHaveURL(/\/onboarding\/step\/4$/)
}

async function connect(page: Page) {
  await page.getByRole('button', { name: 'Connect with Stripe' }).click()
  await expect(page).toHaveURL(/\/onboarding\/pending$/)
  await expect(page.getByRole('heading', { name: 'Your company is under review' })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'web-onb-' } } } })
})

test('the four steps, under review, approved, then the dashboard', async ({ page }, info) => {
  const me = await asNewManager(page)
  const name = venueName()

  // A manager without an approved venue is sent to onboarding from the dashboard.
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/onboarding\/step\/1$/)
  await expect(page.getByRole('heading', { name: 'Tell players about your venue' })).toBeVisible()
  // No skipping ahead.
  await page.goto('/onboarding/step/3')
  await expect(page).toHaveURL(/\/onboarding\/step\/1$/)

  // Step 1 — E09-06.
  await page.getByRole('button', { name: 'Next: location' }).click()
  await expect(page.getByText('Enter the company name')).toBeVisible()
  await page.getByLabel('Company name').fill(name)
  await expect(page.getByText(`${name.length} / 80`)).toBeVisible()
  await page.getByLabel('Website (optional)').fill('not a link')
  await page.getByRole('button', { name: 'Next: location' }).click()
  await expect(page.getByText('Enter a full address, starting with https://')).toBeVisible()
  await page.getByLabel('Website (optional)').fill('')
  await snap(page, info, AREA, '01-company-info', { fullPage: true })
  await fillStep1(page, name)

  // Step 2 — E09-07.
  await expect(page.getByRole('heading', { name: 'Where is it?' })).toBeVisible()
  const progress = page.getByRole('navigation', { name: 'Onboarding progress' })
  await expect(progress.getByRole('link', { name: /Company info/ })).toBeVisible()
  await page.getByRole('button', { name: 'Next: contact & hours' }).click()
  await expect(page.getByText('Enter the street and number')).toBeVisible()
  await expect(page.getByText('Choose a city from the list')).toBeVisible()
  await snap(page, info, AREA, '02-location', { fullPage: true })
  await fillStep2(page)

  // Step 3 — E09-08: Sunday closed, Monday's hours copied to the open days.
  await expect(page.getByRole('heading', { name: 'Contact and opening hours' })).toBeVisible()
  const sunday = page.getByRole('listitem').filter({ hasText: 'Sunday' })
  await sunday.getByRole('switch').check()
  await expect(page.getByLabel('Sunday opens')).toBeHidden()
  await page.getByLabel('Monday opens').selectOption('09:00')
  await page.getByLabel('Monday closes').selectOption('09:00')
  await expect(page.getByText('Closing time must differ from opening time')).toBeVisible()
  await page.getByLabel('Monday closes').selectOption('22:30')
  await page.getByRole('button', { name: /Copy Monday/ }).click()
  await expect(page.getByLabel('Saturday opens')).toHaveValue('09:00')
  await expect(page.getByLabel('Saturday closes')).toHaveValue('22:30')
  await snap(page, info, AREA, '03-contact-hours', { fullPage: true })
  await fillStep3(page)

  const saved = await db.company.findUniqueOrThrow({ where: { ownerId: me.id } })
  const hours = saved.workingHours as { day: number; openTime: string; isClosed: boolean }[]
  expect(hours.find(d => d.day === 0)).toMatchObject({ isClosed: true })
  expect(hours.find(d => d.day === 6)).toMatchObject({ openTime: '09:00', isClosed: false })

  // Step 4 — E09-09.
  await expect(page.getByRole('heading', { name: 'Set up payouts' })).toBeVisible()
  await snap(page, info, AREA, '04-payouts', { fullPage: true })
  await connect(page)
  await snap(page, info, AREA, '05-under-review', { fullPage: true })
  // The dashboard waits for approval.
  await page.goto('/manager/overview')
  await expect(page).toHaveURL(/\/onboarding\/pending$/)

  // The admin approves.
  await signOut(page)
  await signIn(page, 'admin@pitchup.ro', ADMIN_PASSWORD)
  await page.goto('/admin/companies')
  const card = page.getByRole('article', { name })
  await expect(card.getByText(me.email, { exact: false })).toBeVisible()
  await snap(page, info, AREA, '06-admin-approvals', { fullPage: true })
  await card.getByRole('button', { name: 'Approve' }).click()
  await expect(card).toBeHidden()

  // Back as the manager: the dashboard, with the shell.
  await signOut(page)
  await signIn(page, me.email, 'Testing123')
  await page.goto('/onboarding')
  await expect(page).toHaveURL(/\/manager\/overview$/)
  await expect(page.getByText('Revenue today')).toBeVisible()
  await expect(page.getByText(name).first()).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Manager' })
  await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: /^Notifications/ }).click()
  await expect(page.getByText(/approved/i).first()).toBeVisible()
  await snap(page, info, AREA, '07-approved-overview')
})

test('sent back: the reason shows on every step, and submitting again clears it', async ({
  page,
}, info) => {
  const me = await asNewManager(page)
  const name = venueName()
  await page.goto('/onboarding')
  await fillStep1(page, name)
  await fillStep2(page)
  await fillStep3(page)
  await connect(page)

  const reason = 'Please use the venue’s own email, not a personal one.'
  await db.company.update({
    where: { ownerId: me.id },
    data: { status: 'DRAFT', rejectionReason: reason },
  })
  await page.goto('/onboarding')
  await expect(page).toHaveURL(/\/onboarding\/step\/4$/)
  await expect(page.getByRole('alert').filter({ hasText: reason })).toBeVisible()
  await snap(page, info, AREA, '08-sent-back', { fullPage: true })
  // Fix step 3, then submit again.
  await page.goto('/onboarding/step/3')
  await expect(page.getByRole('alert').filter({ hasText: reason })).toBeVisible()
  await fillStep3(page)
  await connect(page)
  expect(await db.company.findUniqueOrThrow({ where: { ownerId: me.id } })).toMatchObject({
    status: 'PENDING',
    rejectionReason: null,
  })
})

test('players and admins are kept out of onboarding and the manager pages', async ({ page }) => {
  await signIn(page, 'player@demo.ro', 'Player1234!')
  for (const path of ['/onboarding/step/1', '/manager/overview', '/dashboard']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/discover/)
  }
  await page.goto('/admin/companies')
  await expect(page).not.toHaveURL(/\/admin/)
  await signOut(page)
  await signIn(page, 'admin@pitchup.ro', ADMIN_PASSWORD)
  await page.goto('/manager/overview')
  await expect(page).toHaveURL(/\/admin\/companies$/)
})

test.describe('at phone width', () => {
  test.use({ viewport: PHONE })

  test('step 3 and the manager menu fit a phone', async ({ page }, info) => {
    await asNewManager(page)
    await page.goto('/onboarding')
    await fillStep1(page, venueName())
    await fillStep2(page)
    const wide = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(wide).toBeLessThanOrEqual(PHONE.width)
    await snap(page, info, AREA, '09-phone-hours', { fullPage: true })

    await signOut(page)
    await signIn(page, 'manager@demo.ro', 'Manager1234!')
    await page.goto('/manager/overview')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(
      page.getByRole('navigation', { name: 'Manager' }).getByRole('link', { name: 'Reviews' })
    ).toBeVisible()
    await snap(page, info, AREA, '10-phone-menu')
  })
})
