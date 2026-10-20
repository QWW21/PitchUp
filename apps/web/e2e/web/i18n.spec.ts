/**
 * Romanian and English — the language switch, the cookie it keeps, and
 * pages in each language. The rest of the suite runs in English
 * (DEFAULT_LOCALE=en in playwright.config.ts); this file sets Romanian itself.
 */
import { expect, test, type BrowserContext } from '@playwright/test'
import { E2E_BASE_URL } from '../support/env'
import { resetRateLimits, signIn } from '../support/helpers'

const romanian = (context: BrowserContext) =>
  context.addCookies([{ name: 'pitchup-locale', value: 'ro', url: E2E_BASE_URL }])

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

// The demo player's language goes back to the default, whatever a test left.
test.afterAll(async () => {
  const { db } = await import('../support/db')
  await db.user.update({ where: { email: 'player@demo.ro' }, data: { locale: null } })
})

test('a venue and a pitch in Romanian', async ({ page, context }) => {
  await romanian(context)
  await page.goto('/discover?city=Cluj-Napoca')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro-RO')
  await expect(page.getByText('Terenuri în')).toBeVisible()
  await page
    .getByRole('link', { name: /Arena Gheorgheni/ })
    .first()
    .click()
  await expect(page.getByRole('tab', { name: /Terenuri \(\d+\)/ })).toBeVisible()
  await page
    .getByRole('link', { name: /Teren 1/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Facilități' })).toBeVisible()
  await expect(page.getByText('Anulare gratuită cu până la')).toBeVisible()
})

test('the switch changes the language and remembers it', async ({ page }) => {
  await page.goto('/discover?city=Cluj-Napoca')
  await expect(page.getByText('Showing pitches in')).toBeVisible()
  await page.getByRole('button', { name: 'Română' }).click()
  await expect(page.getByText('Terenuri în')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Română' })).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByText('Terenuri în')).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByText('Showing pitches in')).toBeVisible()
})

test('a signed-in switch is kept on the account', async ({ page }) => {
  await signIn(page, 'player@demo.ro', 'Player1234!')
  await page.goto('/discover?city=Cluj-Napoca')
  await page.getByRole('button', { name: 'Română' }).click()
  await expect(page.getByText('Terenuri în')).toBeVisible()
  const { db } = await import('../support/db')
  await expect
    .poll(
      async () => (await db.user.findUniqueOrThrow({ where: { email: 'player@demo.ro' } })).locale
    )
    .toBe('ro')
  await page.getByRole('button', { name: 'English' }).click()
  await expect
    .poll(
      async () => (await db.user.findUniqueOrThrow({ where: { email: 'player@demo.ro' } })).locale
    )
    .toBe('en')
})

test('the API answers in the language the app asks for', async ({ request }) => {
  const { venue } = await import('../support/db')
  const pitchId = (await venue('gheorgheni')).pitches[0]!.id
  const policy = async (locale: string) => {
    const res = await request.get(`/api/v1/pitches/${pitchId}`, { headers: { 'x-locale': locale } })
    return ((await res.json()) as { data: { company: { refundPolicy: string } } }).data.company
      .refundPolicy
  }
  expect(await policy('ro')).toMatch(/^Anulare gratuită/)
  expect(await policy('en')).toMatch(/^Free cancellation/)
})
