/**
 * Smoke tests — E15-10: one golden path per role on the seeded data, and the
 * guards between the areas. The detailed checks live in each area's spec;
 * these say quickly whether the site as a whole stands up.
 */
import { expect, test } from '@playwright/test'
import { resetRateLimits, signIn } from '../support/helpers'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test('a player: Discover, a venue, a pitch, and Book Now', async ({ page }) => {
  await signIn(page, 'player@demo.ro', 'Player1234!')
  await page.goto('/discover?city=Cluj-Napoca')
  const venue = page.getByRole('link', { name: /Arena Gheorgheni/ }).first()
  await venue.click()
  await expect(page).toHaveURL(/\/discover\/[^/]+$/)
  await page
    .getByRole('link', { name: /Teren 1/ })
    .first()
    .click()
  await expect(page.getByRole('link', { name: 'Book Now' })).toBeVisible()
})

test('a manager: bookings and analytics', async ({ page }) => {
  await signIn(page, 'manager@demo.ro', 'Manager1234!')
  await page.goto('/manager/bookings')
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeAttached()
  await page.goto('/manager/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Key figures' })).toBeVisible()
})

test('an admin: the overview and the venues', async ({ page }) => {
  await signIn(page, 'admin@pitchup.ro', ADMIN_PASSWORD)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible()
  await page.goto('/admin/companies')
  await expect(page.getByRole('heading', { name: 'All venues' })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
})

test('the guards: signed out to sign in; each role kept to its own area', async ({ page }) => {
  for (const path of ['/admin', '/manager/overview', '/my-bookings']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login/)
  }
  await signIn(page, 'player@demo.ro', 'Player1234!')
  await page.goto('/manager/overview')
  await expect(page).toHaveURL(/\/discover/)
  await page.goto('/admin')
  await expect(page).not.toHaveURL(/\/admin/)
})
