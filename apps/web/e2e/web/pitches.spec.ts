/**
 * Managing pitches in a real browser — E10-06 … E10-10: the list, adding a
 * pitch, and every tab of the editor, with axe scans. Each test makes its own
 * approved venue (open 08:00–23:00, closed Sundays). Cloudinary isn't set up
 * in E2E, so photos are added through the API with Cloudinary-style URLs.
 * Screenshots go to docs/test-evidence/web/pitches.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { addDays, dayOfWeek, formatDateLong, venueClock } from '@pitchup/shared'
import { createVenue, db, uniqueEmail } from '../support/db'
import { PHONE, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'pitches'
const PHOTO_URL = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'

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

async function asNewVenue(page: Page) {
  const email = uniqueEmail('web-pitches')
  const venue = await createVenue(email, `Arena ${Date.now().toString(36)}`)
  await signIn(page, email, 'Testing123')
  return venue
}

async function addPhotos(page: Page, pitchId: string, n: number) {
  for (let i = 0; i < n; i++) {
    const res = await page.request.post(`/api/v1/pitches/${pitchId}/photos`, {
      data: { url: `${PHOTO_URL}?n=${i}`, cloudinaryPublicId: `sample-${i}` },
    })
    expect(res.status()).toBe(201)
  }
}

const pitchIdFromUrl = (page: Page) => page.url().split('/pitches/')[1]!.split('/')[0]!

test.beforeEach(async ({ page }) => {
  await resetRateLimits(page.request)
})

test.afterAll(async () => {
  await db.company.deleteMany({ where: { owner: { email: { startsWith: 'web-pitches-' } } } })
})

test('from no pitches to a live one: every tab of the editor', async ({ page }, info) => {
  await asNewVenue(page)
  await page.goto('/manager/overview')
  await page
    .getByRole('navigation', { name: 'Manager' })
    .getByRole('link', { name: 'Pitches' })
    .click()
  await expect(page.getByRole('heading', { name: 'No pitches yet' })).toBeVisible()
  await snap(page, info, AREA, '01-empty')
  await audit(page)

  await page.getByRole('button', { name: 'Add pitch' }).click()
  await expect(page).toHaveURL(/\/edit\/basic-info$/)
  const id = pitchIdFromUrl(page)

  // Basic info (E10-07).
  await expect(page.getByRole('heading', { name: 'Edit New pitch' })).toBeVisible()
  await page.getByLabel('Pitch name').fill('Teren Central')
  await expect(page.getByText('13 / 60')).toBeVisible()
  await expect(page.getByRole('link', { name: /Basic info.*unsaved changes/ })).toBeVisible()
  await page.locator('label', { hasText: '7v7' }).click()
  await expect(page.getByLabel('Width (m)')).toHaveValue('40')
  await expect(page.getByLabel('Length (m)')).toHaveValue('60')
  await page.locator('label', { hasText: 'Natural grass' }).click()
  await page.getByLabel(/Description/).fill('Floodlit, next to the changing rooms.')
  // Switching on without a photo is caught before saving.
  await page.getByRole('switch', { name: 'Active' }).click()
  await expect(page.getByText('Add at least one photo before activating.')).toBeVisible()
  await page.getByRole('switch', { name: 'Active' }).click()
  await snap(page, info, AREA, '02-basic-info', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  await expect(page.getByRole('heading', { name: 'Edit Teren Central' })).toBeVisible()
  expect(await db.pitch.findUniqueOrThrow({ where: { id } })).toMatchObject({
    name: 'Teren Central',
    size: 'SEVEN_A_SIDE',
    surfaceType: 'NATURAL_GRASS',
    widthMeters: 40,
  })

  // Photos (E10-07): reorder with the buttons, delete.
  await addPhotos(page, id, 3)
  await page.getByRole('link', { name: 'Photos' }).click()
  await expect(page.getByText('3 / 10')).toBeVisible()
  await expect(page.getByText(/uploads aren’t set up here yet/)).toBeVisible()
  const first = await db.pitchPhoto.findFirstOrThrow({ where: { pitchId: id, order: 2 } })
  await page.getByRole('button', { name: 'Move photo 3 earlier' }).click()
  await page.getByRole('button', { name: 'Move photo 2 earlier' }).click()
  await expect(page.getByText('1 · Cover')).toBeVisible()
  await expect
    .poll(async () => (await db.pitchPhoto.findUniqueOrThrow({ where: { id: first.id } })).order)
    .toBe(0)
  await page.getByRole('button', { name: 'Delete photo 3' }).click()
  await expect(page.getByText('2 / 10')).toBeVisible()
  await snap(page, info, AREA, '03-photos', { fullPage: true })
  await audit(page)

  // Amenities.
  await page.getByRole('link', { name: 'Amenities' }).click()
  await page.getByLabel('Wi-Fi').check()
  await page.getByLabel('Night lighting').check()
  await page.getByRole('button', { name: 'Save amenities' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')
  await audit(page)

  // Pricing (E10-08, C-2).
  await page.getByRole('link', { name: 'Pricing' }).click()
  await page.getByLabel('Hourly rate').fill('150')
  await expect(page.getByText(/A player booking 2h pays 300 RON/)).toBeVisible()
  await page.locator('label', { hasText: '90 days ahead' }).click()
  await snap(page, info, AREA, '04-pricing', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Save pricing' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')

  // Shirts (E10-09, C-1).
  await page.getByRole('link', { name: 'Shirts' }).click()
  await page.getByRole('switch', { name: 'Lend shirts' }).click()
  await page.getByLabel('Red sets').fill('2')
  await page.getByLabel('White sets').fill('1')
  await expect(page.getByText('Players can choose: Red (2), White (1).')).toBeVisible()
  await snap(page, info, AREA, '05-shirts', { fullPage: true })
  await audit(page)
  await page.getByRole('button', { name: 'Save shirts' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved.')

  // Availability (E10-10).
  await page.getByRole('link', { name: 'Availability' }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Sunday' }).getByRole('switch')
  ).toBeDisabled()
  await page.getByLabel('Monday opens').selectOption('07:00')
  await expect(page.getByText('Opens before the venue (08:00)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save availability' })).toBeDisabled()
  await page.getByRole('button', { name: 'Copy the venue’s hours' }).click()
  await page.getByLabel('Saturday closes').selectOption('20:00')
  await page.getByRole('button', { name: 'Save availability' }).click()
  await expect(page.getByRole('status').first()).toHaveText('Saved.')

  let blockDay = addDays(venueClock(new Date()).date, 5)
  if (dayOfWeek(blockDay) === 0) blockDay = addDays(blockDay, 1)
  await page.getByLabel('Date', { exact: true }).fill(blockDay)
  await page.getByLabel(/Reason/).fill('Resurfacing')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.getByText(formatDateLong(blockDay, 'en'))).toBeVisible()
  await snap(page, info, AREA, '06-availability', { fullPage: true })
  await audit(page)

  // Back to the list: switch it on.
  await page.getByRole('link', { name: 'Pitches', exact: true }).first().click()
  await expect(page).toHaveURL(/\/manager\/pitches$/)
  await page.getByRole('switch', { name: 'Teren Central active' }).click()
  await expect(
    page.getByRole('row', { name: /Teren Central/ }).getByText('Active', { exact: true })
  ).toBeVisible()
  await expect
    .poll(async () => (await db.pitch.findUniqueOrThrow({ where: { id } })).isActive)
    .toBe(true)
  await snap(page, info, AREA, '07-list')
  await audit(page)
})

test('the list: sorting, a pitch without photos stays off, deleting', async ({ page }) => {
  const venue = await asNewVenue(page)
  for (const name of ['Bravo', 'Alpha', 'Charlie']) {
    await db.pitch.create({
      data: {
        companyId: venue.companyId,
        name,
        surfaceType: 'FUTSAL',
        size: 'FIVE_A_SIDE',
        hourlyRate: 100,
        isActive: false,
      },
    })
  }
  await page.goto('/manager/pitches')
  const names = () => page.locator('tbody tr td:nth-child(2)').allTextContents()
  await expect.poll(names).toEqual(['Alpha', 'Bravo', 'Charlie'])
  await page.getByRole('button', { name: 'Name' }).click()
  await expect.poll(names).toEqual(['Charlie', 'Bravo', 'Alpha'])

  await page.getByRole('switch', { name: 'Alpha active' }).click()
  await expect(
    page.getByText('Add at least one photo to Alpha before activating it.')
  ).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Alpha active' })).toHaveAttribute(
    'aria-checked',
    'false'
  )

  await page.getByRole('button', { name: 'Delete Bravo' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete Bravo?' })
  await expect(dialog.getByText('This cannot be undone.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete pitch' }).click()
  await expect.poll(names).toEqual(['Charlie', 'Alpha'])
})

test.describe('at phone width', () => {
  test.use({ viewport: PHONE })

  test('the editor fits a phone, tabs across the top', async ({ page }, info) => {
    const venue = await asNewVenue(page)
    const pitch = await db.pitch.create({
      data: {
        companyId: venue.companyId,
        name: 'Teren Mic',
        surfaceType: 'FUTSAL',
        size: 'FIVE_A_SIDE',
        hourlyRate: 100,
      },
    })
    await page.goto(`/manager/pitches/${pitch.id}/edit/availability`)
    await expect(page.getByRole('heading', { name: 'Edit Teren Mic' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '08-phone-availability', { fullPage: true })
  })
})
