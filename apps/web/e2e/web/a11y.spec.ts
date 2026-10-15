/**
 * Accessibility — every web page and dialog scanned with axe-core against
 * WCAG 2.1 A and AA. A violation fails the test with the rule, its impact and
 * the offending elements.
 *
 * The map view is left out: its content is Google's, rendered in their
 * canvas, and only exists when a Maps key is set.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addDays, venueClock } from '@pitchup/shared'
import { createPlayer, createResetToken, db, seedBooking, uniqueEmail, venue } from '../support/db'
import { PHONE, resetRateLimits, signIn } from '../support/helpers'

const CLUJ = '/discover?city=Cluj-Napoca'

async function audit(page: Page): Promise<void> {
  // Scans the settled page, not a half-hydrated one.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const report = violations.map(
    v =>
      `${v.impact} · ${v.id}: ${v.help}\n` +
      v.nodes
        .slice(0, 5)
        .map(n => `    ${n.target.join(' ')}\n      ${n.failureSummary?.replace(/\n/g, ' ')}`)
        .join('\n')
  )
  expect(report, `axe violations on ${page.url()}`).toEqual([])
}

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.describe('auth pages', () => {
  for (const path of [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password?token=garbage',
    '/verify-email?email=player%40demo.ro',
    '/registration-confirmed',
  ]) {
    test(path, async ({ page }) => {
      await page.goto(path)
      await audit(page)
    })
  }

  test('/login with an error showing', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[name="email"]').fill('manager@demo.ro')
    await page.locator('input[name="password"]').fill('WrongPassword1')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.locator('form').getByRole('alert')).toBeVisible()
    await audit(page)
  })

  test('/register with field errors showing', async ({ page }) => {
    await page.goto('/register')
    await page.getByRole('button', { name: /Create account/ }).click()
    await expect(page.getByText(/Enter your full name/)).toBeVisible()
    await audit(page)
  })

  test('/reset-password with a valid link', async ({ page }) => {
    const token = await createResetToken('player@demo.ro')
    await page.goto(`/reset-password?token=${token}`)
    await audit(page)
  })

  test('/login on a phone', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto('/login')
    await audit(page)
  })
})

test.describe('manager pages', () => {
  test('/dashboard', async ({ page }) => {
    await signIn(page, 'manager@demo.ro', 'Manager1234!')
    await page.goto('/dashboard')
    await audit(page)
  })
})

test.describe('player pages', () => {
  test('Discover', async ({ page }) => {
    await page.goto(CLUJ)
    await expect(page.getByText('13 venues')).toBeVisible()
    await audit(page)
  })

  test('Discover with no results', async ({ page }) => {
    await page.goto('/discover?city=Oradea')
    await audit(page)
  })

  test('the city dialog', async ({ page }) => {
    await page.goto(CLUJ)
    await page.getByRole('button', { name: 'Change' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page)
  })

  test('the first-visit city prompt', async ({ page, context }) => {
    await context.clearPermissions()
    await page.goto('/discover')
    await expect(page.getByRole('dialog', { name: /Where are you playing/ })).toBeVisible()
    await audit(page)
  })

  test('Discover on a phone, with the filters drawer', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(CLUJ)
    await audit(page)
    await page.getByRole('button', { name: 'Filters' }).click()
    await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
    await audit(page)
  })

  test('the player menu', async ({ page }) => {
    await signIn(page, 'player@demo.ro', 'Player1234!')
    await page.goto(CLUJ)
    await page.getByRole('button', { name: /Account menu/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible()
    await audit(page)
  })

  test('a company page, its hours and its reviews', async ({ page }) => {
    const arena = await venue('cluj-arena-park')
    await page.goto(`/discover/${arena.id}`)
    await page.getByRole('button', { name: /Open|Opens at|Closed today/ }).click()
    await audit(page)
    await page.getByRole('tab', { name: /Reviews/ }).click()
    await expect(page.getByText('out of 5')).toBeVisible()
    await audit(page)
  })

  test('the venue-not-found page', async ({ page }) => {
    const pending = await venue('pending')
    await page.goto(`/discover/${pending.id}`)
    await audit(page)
  })

  test('a pitch page and its lightbox', async ({ page }) => {
    const g = await venue('gheorgheni')
    await page.goto(`/discover/${g.id}/${g.pitches[0]!.id}`)
    await audit(page)
    await page.getByRole('button', { name: /Open photo 1 of/ }).click()
    await expect(page.getByRole('dialog', { name: 'Photos' })).toBeVisible()
    await audit(page)
  })

  test('a pitch page on a phone', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const g = await venue('gheorgheni')
    await page.goto(`/discover/${g.id}/${g.pitches[0]!.id}`)
    await audit(page)
  })
})

test.describe('booking flow', () => {
  const started = new Date()
  const date = addDays(venueClock(started).date, 27)

  test.afterAll(async () => {
    const g = await venue('gheorgheni')
    await db.booking.deleteMany({
      where: { createdAt: { gte: started }, pitchId: g.pitches[0]!.id },
    })
  })

  test('every step, the cancel dialog and the confirmation', async ({ page }) => {
    const g = await venue('gheorgheni')
    const id = g.pitches[0]!.id
    await signIn(page, 'player@demo.ro', 'Player1234!')

    await page.goto(`/book/${id}/date?date=${date}`)
    await expect(page.getByRole('grid')).toBeVisible()
    await audit(page)

    await page.getByRole('button', { name: /^Next: times on/ }).click()
    await page.getByRole('button', { name: '18:00, available' }).click()
    await page.getByRole('button', { name: '19:00, available' }).click()
    await audit(page)

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page)
    await page.getByRole('button', { name: 'Keep editing' }).click()

    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('switch', { name: 'Free shirts' }).click()
    await audit(page)

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Test mode.')).toBeVisible()
    await audit(page)

    await page.getByRole('button', { name: /^Confirm & pay/ }).click()
    await expect(page.getByRole('heading', { name: 'Booking confirmed!' })).toBeVisible()
    await audit(page)
  })
})

test.describe('my bookings', () => {
  test('the list, the detail with its cancel dialog, and the review form', async ({ page }) => {
    const email = uniqueEmail('a11y-mine')
    await createPlayer(email)
    const player = await db.user.findUniqueOrThrow({ where: { email } })
    const g = await venue('gheorgheni')
    const pitchId = g.pitches[1]!.id
    const upcoming = await seedBooking({
      pitchId,
      playerId: player.id,
      startsIn: 5,
      status: 'CONFIRMED',
    })
    const finished = await seedBooking({
      pitchId,
      playerId: player.id,
      startsIn: -26,
      status: 'CONFIRMED',
    })
    await signIn(page, email, 'Testing123')

    await page.goto('/my-bookings')
    await expect(page.getByRole('tabpanel').getByRole('article')).toHaveCount(1)
    await audit(page)
    await page.getByRole('tab', { name: 'Past' }).click()
    await expect(page.getByRole('tabpanel').getByRole('article')).toHaveCount(1)
    await audit(page)

    await page.goto(`/my-bookings/${upcoming.id}`)
    await audit(page)
    await page.getByRole('button', { name: 'Cancel booking' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await audit(page)

    await page.goto(`/my-bookings/${finished.id}/review`)
    await expect(page.getByRole('radiogroup', { name: 'Rating' })).toBeVisible()
    await audit(page)
    await db.booking.deleteMany({ where: { playerId: player.id } })
  })
})
