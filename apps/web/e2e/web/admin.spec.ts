/**
 * The admin panel in a real browser — E15-06 … E15-09: the overview, venues
 * (the list, one venue, suspending and reinstating), users (trust adjusted,
 * suspended, reinstated), review moderation, disputes and the settings,
 * including maintenance mode as a player sees it. Axe scans on every page.
 * Screenshots go to docs/test-evidence/web/admin.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createPlayer, createVenue, db, seedBooking, uniqueEmail } from '../support/db'
import { PHONE, resetRateLimits, signIn, signOut, snap } from '../support/helpers'

const AREA = 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'

async function audit(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`),
    `axe violations on ${page.url()}`
  ).toEqual([])
}

const asAdmin = (page: Page) => signIn(page, 'admin@pitchup.ro', ADMIN_PASSWORD)

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.platformConfig.updateMany({ data: { maintenanceMode: false, subMonthlyRon: 30 } })
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'web-adm-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'web-adm-mgr-' } } } })
})

test('the overview: figures and what waits', async ({ page }, info) => {
  await asAdmin(page)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Figures' }).getByText('Booking value')
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /venues wait for approval/ })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Admin' })
  for (const item of ['Overview', 'Venues', 'Users', 'Disputes', 'Reviews', 'Settings']) {
    await expect(nav.getByRole('link', { name: new RegExp(`^${item}`) })).toBeVisible()
  }
  await snap(page, info, AREA, '01-overview', { fullPage: true })
  await audit(page)
})

test('a venue: found in the list, suspended with a reason, reinstated', async ({ page }, info) => {
  const name = `Web Admin Arena ${Date.now().toString(36)}`
  const v = await createVenue(uniqueEmail('web-adm-mgr'), name)
  await asAdmin(page)
  await page.goto('/admin/companies')
  await page.getByLabel('Name or manager email').fill('Web Admin Arena')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL(/search=Web\+Admin\+Arena/)
  await snap(page, info, AREA, '02-venues', { fullPage: true })
  await audit(page)
  await page.getByRole('link', { name }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/companies/${v.companyId}$`))
  await page.getByRole('button', { name: 'Suspend venue…' }).click()
  const dialog = page.getByRole('dialog', { name: `Suspend ${name}?` })
  await expect(dialog.getByRole('button', { name: 'Suspend' })).toBeDisabled()
  await dialog.getByLabel('Why').fill('Repeated complaints about safety')
  await audit(page)
  await dialog.getByRole('button', { name: 'Suspend' }).click()
  await expect(page.getByText('Suspended: Repeated complaints about safety')).toBeVisible()
  await snap(page, info, AREA, '03-venue-suspended', { fullPage: true })
  await page.getByRole('button', { name: 'Reinstate venue' }).click()
  await expect(page.getByRole('button', { name: 'Suspend venue…' })).toBeVisible()
  expect((await db.company.findUniqueOrThrow({ where: { id: v.companyId } })).status).toBe('ACTIVE')
})

test('a user: trust adjusted with a reason, suspended and reinstated', async ({ page }, info) => {
  const email = uniqueEmail('web-adm-p')
  await createPlayer(email)
  const u = await db.user.update({ where: { email }, data: { name: 'Radu Ionescu' } })
  await asAdmin(page)
  await page.goto('/admin/users')
  await page.getByLabel('Name or email').fill(email)
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('link', { name: 'Radu Ionescu' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/users/${u.id}$`))
  await expect(page.getByRole('heading', { name: 'Trust score: 100 (Excellent)' })).toBeVisible()

  await page.getByLabel('Points (−100 to +100)').fill('-25')
  await page.getByLabel('Reason').first().fill('Rude to venue staff, twice')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByRole('heading', { name: 'Trust score: 75 (Good)' })).toBeVisible()
  await expect(page.getByText('Rude to venue staff, twice')).toBeVisible()
  await snap(page, info, AREA, '04-user', { fullPage: true })
  await audit(page)

  await page.getByRole('button', { name: 'Suspend account…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Suspend Radu Ionescu?' })
  await dialog.getByLabel('Reason (for the record)').fill('Payment fraud investigation')
  await dialog.getByRole('button', { name: 'Suspend' }).click()
  await expect(page.getByText(/Suspended on .*: Payment fraud investigation/)).toBeVisible()
  await page.getByRole('button', { name: 'Reinstate account' }).click()
  await expect(page.getByRole('button', { name: 'Suspend account…' })).toBeVisible()
})

test('a reported review is deleted with a reason', async ({ page }, info) => {
  const author = uniqueEmail('web-adm-p')
  await createPlayer(author)
  const a = await db.user.findUniqueOrThrow({ where: { email: author } })
  const reporter = uniqueEmail('web-adm-p')
  await createPlayer(reporter)
  const r = await db.user.findUniqueOrThrow({ where: { email: reporter } })
  const pitch = await db.pitch.findFirstOrThrow({ where: { company: { status: 'ACTIVE' } } })
  const b = await seedBooking({
    pitchId: pitch.id,
    playerId: a.id,
    startsIn: -50,
    status: 'COMPLETED',
  })
  const review = await db.review.create({
    data: {
      bookingId: b.id,
      pitchId: pitch.id,
      playerId: a.id,
      rating: 1,
      text: 'Visit my shop for discounts!!!',
    },
  })
  await db.reviewReport.create({
    data: { reviewId: review.id, reporterId: r.id, category: 'SPAM' },
  })

  await asAdmin(page)
  await page.goto('/admin/reviews')
  const card = page.getByRole('article').filter({ hasText: 'Visit my shop for discounts!!!' })
  await expect(card.getByText('1 report', { exact: true })).toBeVisible()
  await snap(page, info, AREA, '05-reviews', { fullPage: true })
  await audit(page)
  await card.getByRole('button', { name: 'Delete…' }).click()
  const dialog = page.getByRole('dialog', { name: `Delete this review of ${pitch.name}?` })
  await dialog.getByLabel('Reason').fill('Advertising is not a review.')
  await dialog.getByRole('button', { name: 'Delete review' }).click()
  await expect(card).toBeHidden()
  expect(await db.review.findUnique({ where: { id: review.id } })).toBeNull()
})

test('disputes: open and decided tabs', async ({ page }) => {
  await asAdmin(page)
  await page.goto('/admin/disputes')
  await page
    .getByRole('navigation', { name: 'Disputes' })
    .getByRole('link', { name: 'Decided' })
    .click()
  await expect(page).toHaveURL(/status=resolved/)
  await expect(page.getByText(/decided, newest first/)).toBeVisible()
  await audit(page)
})

test('settings: the subscription prices, and maintenance mode as a player sees it', async ({
  page,
  browser,
}, info) => {
  await asAdmin(page)
  await page.goto('/admin/config')
  await expect(page.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  await page.getByLabel('From the second year, monthly').fill('35')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('status')).toHaveText('Settings saved.')
  await snap(page, info, AREA, '06-settings', { fullPage: true })
  await audit(page)

  page.once('dialog', d => void d.accept())
  await page.getByRole('switch').check()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('status')).toHaveText('Settings saved.')
  try {
    const other = await browser.newContext()
    const visitor = await other.newPage()
    await visitor.goto('/discover')
    await expect(visitor.getByRole('heading', { name: 'We’ll be right back' })).toBeVisible()
    await snap(visitor, info, AREA, '07-maintenance')
    await other.close()
    // Admins carry on.
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible()
  } finally {
    // Through the API, so the server's cached setting is dropped too.
    await page.request.put('/api/v1/admin/config', {
      data: { maintenanceMode: false, platformFeePercent: 8 },
    })
  }
})

test('people who are not admins are kept out', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
  await signIn(page, 'player@demo.ro', 'Player1234!')
  await page.goto('/admin/users')
  await expect(page).not.toHaveURL(/\/admin/)
  await signOut(page)
})

test.describe('at phone width', () => {
  test.use({ viewport: PHONE })

  test('the overview and users fit a phone', async ({ page }, info) => {
    await asAdmin(page)
    for (const path of ['/admin', '/admin/users']) {
      await page.goto(path)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        PHONE.width
      )
    }
    await snap(page, info, AREA, '08-phone-users', { fullPage: true })
  })
})
