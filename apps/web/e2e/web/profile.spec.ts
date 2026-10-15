/**
 * The player's profile in a real browser — E08-08: overview, settings,
 * trust score, change password, payment methods and deleting the account.
 * Each test signs in a fresh player. Screenshots go to
 * docs/test-evidence/web/profile.
 */
import { expect, test, type Page } from '@playwright/test'
import { createPlayer, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'profile'
const HOUR = 3_600_000

let me: { id: string; email: string }

async function asNewPlayer(page: Page) {
  const email = uniqueEmail('web-prof')
  await createPlayer(email)
  const user = await db.user.update({ where: { email }, data: { name: 'Maria Ionescu' } })
  me = { id: user.id, email }
  await signIn(page, email, 'Testing123')
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
  await asNewPlayer(page)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'web-prof-' } } } })
})

test('the overview, from the account menu', async ({ page }, info) => {
  await page.goto('/discover?city=Cluj-Napoca')
  await page.getByRole('button', { name: /Account menu/ }).click()
  await page.getByRole('menuitem', { name: 'Profile' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  const details = page.getByRole('region', { name: 'Your details' })
  await expect(details.getByText('Maria Ionescu')).toBeVisible()
  await expect(details.getByText(me.email)).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'Trust score 100 out of 100, Excellent' })
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Profile' }).getByRole('link', { name: 'Overview' })
  ).toHaveAttribute('aria-current', 'page')
  await snap(page, info, AREA, '01-overview')

  await page.getByRole('link', { name: 'View history →' }).click()
  await expect(page).toHaveURL(/\/profile\/trust-score$/)
})

test('account settings: change name and city; a bad phone is caught', async ({ page }, info) => {
  await page.goto('/profile/settings')
  const save = page.getByRole('button', { name: 'Save changes' })
  await expect(save).toBeDisabled()
  await expect(page.getByText('Email cannot be changed.')).toBeVisible()

  await page.getByLabel('Phone').fill('0712')
  await save.click()
  await expect(page.getByText(/Phone must include country code/)).toBeVisible()
  await page
    .getByLabel('Phone')
    .fill((await db.user.findUniqueOrThrow({ where: { id: me.id } })).phone)

  await page.getByLabel('Full name').fill('Maria Pop')
  await page.getByLabel('City').selectOption('Iași')
  await snap(page, info, AREA, '02-settings')
  await save.click()
  await expect(page.getByRole('status')).toContainText('Your changes are saved')
  expect(await db.user.findUniqueOrThrow({ where: { id: me.id } })).toMatchObject({
    name: 'Maria Pop',
    city: 'Iași',
  })
  await page.getByRole('link', { name: 'Overview' }).click()
  await expect(page.getByRole('region', { name: 'Your details' })).toContainText('Maria Pop')
  await expect(page.getByRole('region', { name: 'Your details' })).toContainText('Iași')
})

test('trust score: the ring, the tiers, and the history in pages', async ({ page }, info) => {
  const g = await venue('gheorgheni')
  const b = await seedBooking({
    pitchId: g.pitches[1]!.id,
    playerId: me.id,
    startsIn: -48,
    status: 'COMPLETED',
  })
  await db.trustScoreEvent.createMany({
    data: [
      ...Array.from({ length: 22 }, (_, i) => ({
        userId: me.id,
        delta: 1,
        reason: 'MONTHLY_RECOVERY' as const,
        createdAt: new Date(Date.now() - (200 + i) * 24 * HOUR),
      })),
      {
        userId: me.id,
        delta: -5,
        reason: 'LATE_CANCEL' as const,
        createdAt: new Date(Date.now() - 2 * HOUR),
      },
      {
        userId: me.id,
        delta: 2,
        reason: 'BOOKING_COMPLETED' as const,
        relatedBookingId: b.id,
        createdAt: new Date(Date.now() - HOUR),
      },
    ],
  })
  await db.user.update({ where: { id: me.id }, data: { trustScore: 64 } })

  await page.goto('/profile/trust-score')
  await expect(page.getByRole('img', { name: 'Trust score 64 out of 100, Fair' })).toBeVisible()
  await expect(page.getByText('A card on file is required.').first()).toBeVisible()
  await expect(page.locator('tr[aria-current="true"]')).toContainText('Fair')
  const history = page.getByRole('region', { name: 'History' })
  await expect(history.getByText('+2')).toBeVisible()
  await expect(history.getByText('−5')).toBeVisible()
  await snap(page, info, AREA, '03-trust-score', { fullPage: true })

  // 24 events, 20 a page: the rest load as the end comes into view.
  await history.getByRole('button', { name: 'Show older' }).scrollIntoViewIfNeeded()
  await expect(history.getByText('Monthly recovery')).toHaveCount(22)
  await expect(history.getByRole('button', { name: 'Show older' })).toHaveCount(0)

  await history.getByRole('link', { name: /Booking completed/ }).click()
  await expect(page).toHaveURL(new RegExp(`/my-bookings/${b.id}$`))
})

test('change password: the current one is checked, then sign in again', async ({ page }, info) => {
  await page.goto('/profile/change-password')
  const submit = page.getByRole('button', { name: 'Change password' })
  await page.getByLabel('Current password').fill('NotMyPass1')
  await page.getByLabel('New password', { exact: true }).fill('BrandNew123')
  await page.getByLabel('Confirm new password').fill('BrandNew124')
  await submit.click()
  await expect(page.getByText('Passwords do not match')).toBeVisible()

  await page.getByLabel('Confirm new password').fill('BrandNew123')
  await submit.click()
  await expect(page.getByText('Your password is not correct')).toBeVisible()
  await snap(page, info, AREA, '04-change-password-wrong')

  await page.getByLabel('Current password').fill('Testing123')
  await submit.click()
  await expect(page).toHaveURL(/\/login\?notice=password-changed/)
  await expect(page.getByRole('status')).toContainText('Your password is changed')

  await page.getByLabel('Email').fill(me.email)
  await page.getByLabel('Password', { exact: true }).fill('BrandNew123')
  await page.getByRole('button', { name: /Sign in/ }).click()
  // Signed in: players are taken on to Discover.
  await expect(page).toHaveURL(/\/discover/)
  await page.goto('/profile')
  await expect(page.getByRole('region', { name: 'Your details' })).toContainText('Maria Ionescu')
})

test('payment methods without Stripe say so', async ({ page }, info) => {
  await page.goto('/profile/payment-methods')
  await expect(page.getByText(/Saving cards needs Stripe/)).toBeVisible()
  await expect(page.getByText('No saved cards')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add new card' })).toHaveCount(0)
  await snap(page, info, AREA, '05-payment-methods')
})

test('deleting the account: password, are-you-sure, then signed out', async ({ page }, info) => {
  await page.goto('/profile/delete-account')
  await expect(page.getByText('This is permanent and cannot be undone')).toBeVisible()
  const submit = page.getByRole('button', { name: 'Permanently delete my account' })
  await submit.click()
  await expect(page.getByText('Enter your password')).toBeVisible()

  await page.getByLabel('Password', { exact: true }).fill('NotMyPass1')
  page.once('dialog', d => d.accept())
  await submit.click()
  await expect(page.getByText('Your password is not correct')).toBeVisible()

  await page.getByLabel('Password', { exact: true }).fill('Testing123')
  await page.getByLabel(/Why are you leaving/).fill('Testing the delete flow')
  await snap(page, info, AREA, '06-delete-account')
  // "Cancel" on the confirmation keeps everything.
  page.once('dialog', d => d.dismiss())
  await submit.click()
  expect((await db.user.findUniqueOrThrow({ where: { id: me.id } })).deletedAt).toBeNull()

  page.once('dialog', d => d.accept())
  await submit.click()
  await expect(page).toHaveURL(/\/discover\?accountDeleted=1/)
  await expect(page.getByText('Your account has been deleted.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  expect((await db.user.findUniqueOrThrow({ where: { id: me.id } })).deletedAt).not.toBeNull()
})

test('signed-out visitors sign in first; a phone fits', async ({ page, context }, info) => {
  await page.setViewportSize(PHONE)
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(overflow).toBe(false)
  await snap(page, info, AREA, '07-phone')

  await context.clearCookies()
  await page.goto('/profile/settings')
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fprofile/)
})
