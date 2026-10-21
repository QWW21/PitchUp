/**
 * The manager's Subscription tab in a real browser — C-15: the banner while
 * the venue isn't live, the prices, starting the free month in test mode,
 * a failed bill and paying it, and cancelling. Screenshots go to
 * docs/test-evidence/web/billing.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createVenue, db, uniqueEmail } from '../support/db'
import { resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'billing'

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

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'web-bill-' } } } })
})

test('a new venue starts its free month, a bill fails and is paid, then it cancels', async ({
  page,
}, info) => {
  const email = uniqueEmail('web-bill')
  const venue = await createVenue(email, `Billing Park ${Date.now().toString(36)}`)
  // As just after approval: no subscription yet.
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
  await signIn(page, email, 'Testing123')

  // Every manager page says the venue isn't live, and where to fix it.
  await page.goto('/manager/overview')
  await expect(page.getByText(/Your venue isn’t live yet|Your venue isn't live yet/)).toBeVisible()
  await page.getByRole('link', { name: 'Go to Subscription' }).click()
  await expect(page).toHaveURL(/\/manager\/settings\/billing$/)

  await expect(page.getByText('Not live', { exact: true })).toBeVisible()
  await expect(page.getByText('10 lei / month', { exact: true })).toBeVisible()
  await expect(page.getByText('100 lei / year', { exact: true })).toBeVisible()
  await snap(page, info, AREA, '01-not-live', { fullPage: true })
  await audit(page)

  await page.getByRole('button', { name: 'Start your free month (30 days)' }).click()
  await expect(page.getByText('Free month', { exact: true })).toBeVisible()
  await expect(page.getByText(/^Free until /)).toBeVisible()
  await expect(page.getByText(/Your venue isn’t live yet|Your venue isn't live yet/)).toHaveCount(0)
  await snap(page, info, AREA, '02-free-month', { fullPage: true })

  // Test mode: the next bill fails, then is paid.
  await page.getByRole('button', { name: 'Fail' }).click()
  await expect(page.getByText('Payment failed', { exact: true })).toBeVisible()
  await expect(page.getByText(/Update your card by/).first()).toBeVisible()
  await snap(page, info, AREA, '03-payment-failed', { fullPage: true })
  await page.getByRole('button', { name: 'Pay now' }).click()
  await expect(page.getByText('Active', { exact: true })).toBeVisible()
  await expect(page.getByText('10 lei · Monthly')).toBeVisible()
  await audit(page)

  // Cancelling asks first, then runs to the end of the period.
  page.once('dialog', d => void d.accept())
  await page.getByRole('button', { name: 'Cancel subscription' }).click()
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keep my subscription' })).toBeVisible()
  await snap(page, info, AREA, '04-cancelling', { fullPage: true })
})
