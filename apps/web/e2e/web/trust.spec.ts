/**
 * Trust in a real browser — E12-08, E12-09 and the admin's dispute page
 * (E12-04): a manager limits a pitch to better players, a player below the
 * line is told why on the pitch page, and an admin decides a dispute. With
 * axe scans. Screenshots go to docs/test-evidence/web/trust.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { createPlayer, createVenue, db, seedBooking, uniqueEmail } from '../support/db'
import { resetRateLimits, signIn, signOut, snap } from '../support/helpers'

const AREA = 'trust'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin1234!'
const PHOTO = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'

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

async function setup() {
  const email = uniqueEmail('web-trust-mgr')
  const v = await createVenue(email, `Trust Arena ${Date.now().toString(36)}`)
  const pitch = await db.pitch.create({
    data: {
      companyId: v.companyId,
      name: 'Teren Select',
      surfaceType: 'ARTIFICIAL_GRASS',
      size: 'FIVE_A_SIDE',
      hourlyRate: 120,
      isActive: true,
      photos: { create: { url: PHOTO, cloudinaryPublicId: 'sample', order: 0 } },
    },
  })
  const playerEmail = uniqueEmail('web-trust-p')
  await createPlayer(playerEmail)
  const player = await db.user.update({
    where: { email: playerEmail },
    data: { name: 'Radu Fair', trustScore: 60 },
  })
  return { ...v, email, pitch, player, playerEmail }
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.booking.deleteMany({ where: { player: { email: { startsWith: 'web-trust-p-' } } } })
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'web-trust-mgr-' } } } })
})

test('a manager limits a pitch to Good players; a Fair player is told why', async ({
  page,
}, info) => {
  const s = await setup()
  await signIn(page, s.email, 'Testing123')
  await page.goto(`/manager/pitches/${s.pitch.id}/edit/basic-info`)
  await page.locator('label', { hasText: 'Good and above' }).click()
  await page.locator('label', { hasText: 'Excellent only' }).click()
  await expect(page.getByText(/Very few players qualify/)).toBeVisible()
  await page.locator('label', { hasText: 'Good and above' }).click()
  await snap(page, info, AREA, '01-who-can-book', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  expect((await db.pitch.findUniqueOrThrow({ where: { id: s.pitch.id } })).minTrustScore).toBe(70)
  await page.goto('/manager/pitches')
  await expect(page.getByRole('row', { name: /Teren Select/ }).getByText('Good+')).toBeVisible()

  await signOut(page)
  await signIn(page, s.playerEmail, 'Testing123')
  await page.goto(`/discover/${s.companyId}/${s.pitch.id}`)
  await expect(
    page.getByText('For players with a Good trust score or better.').first()
  ).toBeVisible()
  await expect(page.getByText('Can’t book here').first()).toBeVisible()
  await expect(
    page
      .getByText('This pitch is for players with a Good trust score or better. Yours is Fair.')
      .first()
  ).toBeVisible()
  await snap(page, info, AREA, '02-pitch-blocked', { fullPage: true })
  await audit(page)
  // The booking flow sends them back to the pitch page.
  await page.goto(`/book/${s.pitch.id}/date`)
  await expect(page).toHaveURL(new RegExp(`/discover/${s.companyId}/${s.pitch.id}$`))
  await page.getByRole('link', { name: 'Your trust score' }).first().click()
  await expect(page).toHaveURL(/\/profile\/trust-score$/)
})

test('an admin decides a no-show dispute for the player', async ({ page }, info) => {
  const s = await setup()
  const b = await seedBooking({
    pitchId: s.pitch.id,
    playerId: s.player.id,
    startsIn: -2,
    status: 'NO_SHOW',
  })
  await db.noShow.create({
    data: {
      bookingId: b.id,
      reportedByManagerId: s.userId,
      reason: 'Nobody turned up.',
      penaltyAmount: 240,
      disputeStatus: 'OPEN',
      disputeText: 'We played: the receptionist checked us in at 18:00.',
    },
  })
  await signIn(page, 'admin@pitchup.ro', ADMIN_PASSWORD)
  await page.goto('/admin/companies')
  await page
    .getByRole('navigation', { name: 'Admin' })
    .getByRole('link', { name: 'Disputes' })
    .click()
  const card = page.getByRole('article', { name: /Radu Fair at Trust Arena/ })
  await expect(card.getByText('We played: the receptionist checked us in at 18:00.')).toBeVisible()
  await expect(card.getByRole('button', { name: 'The player was right' })).toBeDisabled()
  await card.getByLabel(/Decision note/).fill('The venue confirmed the check-in.')
  await snap(page, info, AREA, '03-dispute', { fullPage: true })
  await audit(page)
  await card.getByRole('button', { name: 'The player was right' }).click()
  await expect(card).toBeHidden()
  const after = await db.booking.findUniqueOrThrow({ where: { id: b.id } })
  expect(after.status).toBe('COMPLETED')
  expect((await db.user.findUniqueOrThrow({ where: { id: s.player.id } })).trustScore).toBe(70)

  // The player sees it in their trust history.
  await signOut(page)
  await signIn(page, s.playerEmail, 'Testing123')
  await page.goto('/profile/trust-score')
  await expect(page.getByText('Dispute resolved in your favour')).toBeVisible()
})
