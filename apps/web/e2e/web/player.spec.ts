/**
 * Player pages in a real browser — T-07: Discover, the map, company and
 * pitch detail. Evidence screenshots go to docs/test-evidence/web/player.
 */
import { expect, test } from '@playwright/test'
import { addDays, dayOfWeek, DAY_LONG, venueClock } from '@pitchup/shared'
import { db, venue } from '../support/db'
import { PHONE, signIn, signOut, snap } from '../support/helpers'

const AREA = 'player'
const CLUJ = '/discover?city=Cluj-Napoca'

test.describe('Discover', () => {
  test('lists the city’s venues', async ({ page }, info) => {
    await page.goto(CLUJ)
    await expect(page.getByText('Showing pitches in')).toContainText('Cluj-Napoca')
    await expect(page.getByText('13 venues')).toBeVisible()
    await expect(page.getByRole('link', { name: /Arena Gheorgheni/ })).toBeVisible()
    await snap(page, info, AREA, '01-discover')
  })

  test('filters update the URL and the results', async ({ page }, info) => {
    await page.goto(CLUJ)
    await expect(page.getByText('13 venues')).toBeVisible()
    // Not .check(): the box is driven by the URL, so it flips only once the
    // router has updated it — which is what is being tested.
    await page.getByLabel('Futsal').click()
    await expect(page).toHaveURL(/surface=FUTSAL/)
    await expect(page.getByLabel('Futsal')).toBeChecked()
    await expect(page.getByText('2 venues')).toBeVisible()
    await expect(page.getByRole('link', { name: /Futsal Center/ })).toBeVisible()
    await snap(page, info, AREA, '02-discover-filtered')

    await page.getByRole('button', { name: 'Reset all filters' }).click()
    await expect(page).not.toHaveURL(/surface=/)
    await expect(page.getByText('13 venues')).toBeVisible()
  })

  test('search waits for typing to stop: one request', async ({ page }) => {
    await page.goto(CLUJ)
    await expect(page.getByText('13 venues')).toBeVisible()
    const searches: string[] = []
    page.on('request', r => {
      if (r.url().includes('/api/v1/companies') && r.url().includes('search='))
        searches.push(r.url())
    })
    await page.getByLabel('Search companies').pressSequentially('grig', { delay: 50 })
    await expect(page).toHaveURL(/search=grig/)
    await expect(page.getByText('1 venue')).toBeVisible()
    expect(searches).toHaveLength(1)
  })

  test('sorting by price orders the cards', async ({ page }) => {
    await page.goto(CLUJ)
    await page.getByRole('combobox').selectOption('price')
    await expect(page).toHaveURL(/sort=price/)
    const prices = await page.locator('section[aria-label="Companies"] a').allInnerTexts()
    const values = prices.map(t => Number(t.match(/from (\d+) RON/)?.[1]))
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })

  test('an empty city says so, with a way out', async ({ page }, info) => {
    await page.goto('/discover?city=Oradea')
    await expect(page.getByText('No pitches found in Oradea')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeVisible()
    await snap(page, info, AREA, '03-discover-empty')
  })

  test('the city dialog searches without diacritics', async ({ page }, info) => {
    await page.goto(CLUJ)
    await page.getByRole('button', { name: 'Change' }).click()
    await page.getByLabel('Search cities').fill('timis')
    const rows = page.getByRole('dialog').getByRole('listitem')
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText('Timișoara')
    await snap(page, info, AREA, '04-city-dialog')
    await rows.getByRole('button').click()
    await expect(page).toHaveURL(/city=Timi%C8%99oara/)
  })

  test('a first visit with no city and no location asks for one', async ({ page, context }) => {
    await context.clearPermissions()
    await page.goto('/discover')
    await expect(page.getByRole('dialog', { name: /Where are you playing/ })).toBeVisible()
    // Cannot be dismissed until a city is chosen.
    await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0)
  })

  test('on a phone the filters move into a drawer', async ({ page }, info) => {
    await page.setViewportSize(PHONE)
    await page.goto(`${CLUJ}&amenity=showers`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '05-discover-phone')
    await page.getByRole('button', { name: 'Filters' }).click()
    const drawer = page.getByRole('dialog', { name: 'Filters' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByLabel('Showers')).toBeChecked()
    await expect(drawer.getByRole('button', { name: /Show \d+ results/ })).toBeVisible()
    await snap(page, info, AREA, '06-discover-phone-filters')
  })

  test('filters: 6v6 with an explanation, and only "Available now" (C-3, C-4)', async ({
    page,
  }, info) => {
    await page.goto(CLUJ)
    const sidebar = page.getByRole('group', { name: /Pitch size/ })
    await expect(sidebar.getByLabel('6v6')).toBeVisible()
    await sidebar.getByLabel('6v6').click()
    await expect(page).toHaveURL(/size=SIX_A_SIDE/)
    await expect(page.getByText('2 venues')).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Available now' })).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Open now' })).toHaveCount(0)
    await sidebar.getByRole('button', { name: 'About pitch sizes' }).hover()
    await expect(sidebar.getByRole('tooltip')).toBeVisible()
    await snap(page, info, AREA, '18-filters-size-info')
  })

  test('the map opens on the chosen city, not where the player is (C-5)', async ({
    page,
    context,
  }, info) => {
    // The player is in Cluj, browsing București.
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 46.77, longitude: 23.59 })
    await page.goto('/discover?city=Bucure%C8%99ti&view=map')
    const pills = page.getByRole('button', { name: /, from \d+ RON$/ })
    const noKey = page.getByText('The map needs a Google Maps key')
    await expect(noKey.or(pills.first())).toBeVisible()
    test.skip(await noKey.isVisible(), 'needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY')

    // Every București pill is inside the map, so the map is on București.
    await expect(pills).toHaveCount(2)
    const map = (await page.getByTestId('discover-map').boundingBox())!
    for (const pill of await pills.all()) {
      const box = (await pill.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(map.x)
      expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width)
      expect(box.y).toBeGreaterThanOrEqual(map.y)
      expect(box.y + box.height).toBeLessThanOrEqual(map.y + map.height)
    }
    await snap(page, info, AREA, '19-map-selected-city')
  })

  test('map view: pills and a preview with a key, a clear message without one', async ({
    page,
  }, info) => {
    await page.goto(`${CLUJ}&view=map`)
    const noKey = page.getByText('The map needs a Google Maps key')
    const pills = page.getByRole('button', { name: /, from \d+ RON$/ })
    await expect(noKey.or(pills.first())).toBeVisible()
    if (await noKey.isVisible()) {
      await snap(page, info, AREA, '07-map-no-key')
      return
    }
    await expect(pills).toHaveCount(13)
    await snap(page, info, AREA, '07-map')
    await pills.filter({ hasText: 'from 350 RON' }).click()
    await expect(page.getByRole('link', { name: 'View company' })).toBeVisible()
    await snap(page, info, AREA, '08-map-preview')
  })
})

test.describe('company page', () => {
  test('hero, hours and pitches', async ({ page }, info) => {
    const g = await venue('gheorgheni')
    await page.goto(`/discover/${g.id}`)
    await expect(page).toHaveTitle('Arena Gheorgheni — Cluj-Napoca | PitchUp')
    await expect(page.getByRole('heading', { name: /Arena Gheorgheni/ })).toBeVisible()
    await expect(page.getByText('Verified')).toBeVisible()
    await expect(page.getByRole('link', { name: /Teren 1/ })).toBeVisible()
    await snap(page, info, AREA, '09-company')

    // The hours line reads "Open · …", "Opens at …" or "Closed today" depending on the time.
    await page.getByRole('button', { name: /Open|Opens at|Closed today/ }).click()
    await expect(page.getByText('Wednesday')).toBeVisible()
    await expect(page.locator('dt.font-semibold')).toHaveCount(1)
  })

  test('reviews tab: breakdown, paging and the pitch filter', async ({ page }, info) => {
    const arena = await venue('cluj-arena-park')
    await page.goto(`/discover/${arena.id}`)
    await page.getByRole('tab', { name: /Reviews/ }).click()
    await expect(page).toHaveURL(/tab=reviews/)
    await expect(page.getByText('out of 5')).toBeVisible()
    const cards = page.getByRole('tabpanel').locator('article')
    await expect(cards).toHaveCount(10)
    await snap(page, info, AREA, '10-company-reviews')
    await page.getByRole('button', { name: 'Load more reviews' }).click()
    await expect(cards).toHaveCount(14)
    await expect(page.getByRole('button', { name: 'Load more reviews' })).toHaveCount(0)

    await page.getByLabel('Show reviews for').selectOption({ label: arena.pitches[0]!.name })
    const pitchReviews = await db.review.count({ where: { pitchId: arena.pitches[0]!.id } })
    await expect(cards).toHaveCount(Math.min(pitchReviews, 10))
  })

  test('an unapproved company is a 404 page', async ({ page }) => {
    const pending = await venue('pending')
    const res = await page.goto(`/discover/${pending.id}`)
    expect(res?.status()).toBe(404)
    await expect(page.getByText('We couldn’t find that venue')).toBeVisible()
  })
})

test.describe('pitch page', () => {
  test('content, metadata and the seeded availability', async ({ page }, info) => {
    const g = await venue('gheorgheni')
    const teren = g.pitches[0]!
    await page.goto(`/discover/${g.id}/${teren.id}`)
    await expect(page).toHaveTitle('Teren 1 — Arena Gheorgheni | PitchUp')
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /picsum/)
    await expect(page.getByText('About this pitch')).toBeVisible()
    await expect(
      page.locator('li').filter({ hasText: 'Wi-Fi' }).locator('.line-through')
    ).toHaveCount(1)
    // One rate at any time (C-2) and free shirts (C-1).
    await expect(page.getByText('Any time')).toBeVisible()
    await expect(page.getByText(/Peak|Off-peak/)).toHaveCount(0)
    await expect(page.locator('p', { hasText: 'Free shirts' })).toContainText(
      'Free shirts in red, blue and yellow. Ask for them when you book'
    )

    const today = venueClock(new Date()).date
    const day = (offset: number) => {
      const date = addDays(today, offset)
      return page.getByLabel(new RegExp(`^${DAY_LONG[dayOfWeek(date)]} ${date}: `))
    }
    await expect(day(2)).toHaveAttribute('aria-label', /fully booked/)
    await expect(day(3)).toHaveAttribute('aria-label', /closed/)
    await expect(day(1)).toHaveAttribute('aria-label', /slots available/)
    await snap(page, info, AREA, '11-pitch', { fullPage: true })

    await day(3).click()
    await expect(page.getByRole('status')).toContainText('This pitch is closed on')
  })

  test('the size explains itself on hover and on focus (C-3)', async ({ page }, info) => {
    const g = await venue('gheorgheni')
    await page.goto(`/discover/${g.id}/${g.pitches[0]!.id}`)
    const info_ = page.getByRole('button', { name: 'About pitch sizes' })
    const tip = page.getByRole('tooltip')
    await expect(tip).toBeHidden()
    await info_.hover()
    await expect(tip).toBeVisible()
    await expect(tip).toContainText('the price is the same however many of you come')
    await snap(page, info, AREA, '17-size-info')
    await page.mouse.move(0, 0)
    await expect(tip).toBeHidden()
    await info_.focus()
    await expect(tip).toBeVisible()
  })

  test('gallery and lightbox', async ({ page }, info) => {
    const g = await venue('gheorgheni')
    await page.goto(`/discover/${g.id}/${g.pitches[0]!.id}`)
    await page.getByRole('button', { name: 'Show photo 3' }).click()
    await expect(page.getByText(/^3 \/ \d$/)).toBeVisible()
    await page.getByRole('button', { name: /Open photo 3 of/ }).click()
    const lightbox = page.getByRole('dialog', { name: 'Photos' })
    await expect(lightbox).toBeVisible()
    await snap(page, info, AREA, '12-lightbox')
    await page.keyboard.press('ArrowRight')
    await expect(lightbox).toContainText(/^4 \//)
    await page.keyboard.press('Escape')
    await expect(lightbox).toHaveCount(0)
  })

  test('Book Now: signed out → sign in → back to booking', async ({ page }, info) => {
    const g = await venue('gheorgheni')
    const teren = g.pitches[0]!
    await page.goto(`/discover/${g.id}/${teren.id}`)
    await page.getByRole('link', { name: 'Sign in to book' }).click()
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fbook%2F/)
    await page.locator('input[name="email"]').fill('player@demo.ro')
    await page.locator('input[name="password"]').fill('Player1234!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    // Lands on the booking flow's first step (E05).
    await expect(page).toHaveURL(new RegExp(`/book/${teren.id}/date`))
    await expect(page.getByRole('heading', { name: 'Pick a date' })).toBeVisible()
    await snap(page, info, AREA, '13-booking-start')
  })

  test('Book Now is replaced for a suspended account and an inactive pitch', async ({
    page,
  }, info) => {
    const g = await venue('gheorgheni')
    await db.user.update({ where: { email: 'player@demo.ro' }, data: { trustScore: 20 } })
    try {
      await signIn(page, 'player@demo.ro', 'Player1234!')
      await page.goto(`/discover/${g.id}/${g.pitches[0]!.id}`)
      await expect(page.getByText('Can’t book here').first()).toBeVisible()
      await expect(
        page.getByText('Your account cannot make bookings right now').first()
      ).toBeVisible()
      await expect(page.getByRole('link', { name: 'Book Now' })).toHaveCount(0)
      await snap(page, info, AREA, '14-account-restricted')
    } finally {
      await db.user.update({ where: { email: 'player@demo.ro' }, data: { trustScore: 100 } })
      await signOut(page)
    }

    const inactive = await venue('inactive')
    await page.goto(`/discover/${inactive.id}/${inactive.pitches[0]!.id}`)
    await expect(page.getByText('Not available', { exact: true })).toBeVisible()
    await expect(page.getByText('No photos available')).toBeVisible()
    await snap(page, info, AREA, '15-pitch-not-available')
  })

  test('a pitch under the wrong company redirects to its real address', async ({ page }) => {
    const g = await venue('gheorgheni')
    const arena = await venue('cluj-arena-park')
    await page.goto(`/discover/${arena.id}/${g.pitches[0]!.id}`)
    await expect(page).toHaveURL(new RegExp(`/discover/${g.id}/${g.pitches[0]!.id}$`))
  })

  test('"See all reviews" opens the company reviews filtered to the pitch', async ({ page }) => {
    const g = await venue('gheorgheni')
    await page.goto(`/discover/${g.id}/${g.pitches[0]!.id}`)
    await page.getByRole('link', { name: /See all \d+ reviews/ }).click()
    await expect(page).toHaveURL(/tab=reviews&pitch=/)
    await expect(page.getByLabel('Show reviews for')).toHaveValue(g.pitches[0]!.id)
  })

  test('on a phone the booking panel follows the gallery, full width', async ({ page }, info) => {
    const g = await venue('gheorgheni')
    await page.setViewportSize(PHONE)
    await page.goto(`/discover/${g.id}/${g.pitches[0]!.id}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    const aside = await page.locator('aside').boundingBox()
    expect(aside?.width).toBeGreaterThan(PHONE.width - 40)
    await snap(page, info, AREA, '16-pitch-phone', { fullPage: true })
  })
})
