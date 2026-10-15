/**
 * Shared steps for E2E specs: rate-limit reset, sign-in, and evidence
 * screenshots.
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { APIRequestContext, Page, TestInfo } from '@playwright/test'

/** Clears the server's in-memory rate limits (enabled by ALLOW_TEST_HOOKS). */
export async function resetRateLimits(request: APIRequestContext): Promise<void> {
  const res = await request.post('/api/v1/dev/reset-rate-limits')
  if (!res.ok())
    throw new Error(`Rate-limit reset refused (${res.status()}). Is ALLOW_TEST_HOOKS set?`)
}

/**
 * Signs a browser context in through NextAuth's credentials endpoint — the
 * same request the login form makes — without driving the form. Tests of the
 * login form itself use the form.
 */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  const { csrfToken } = await (await page.request.get('/api/auth/csrf')).json()
  const res = await page.request.post('/api/auth/callback/credentials', {
    form: { csrfToken, email, password, callbackUrl: '/' },
    headers: { 'X-Auth-Return-Redirect': '1' },
  })
  const { url } = await res.json()
  if (String(url).includes('error=')) throw new Error(`Sign-in failed for ${email}: ${url}`)
}

/** The same sign-in for an API client: its cookie jar then holds the session. */
export async function signInApi(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<void> {
  const { csrfToken } = await (await request.get('/api/auth/csrf')).json()
  const res = await request.post('/api/auth/callback/credentials', {
    form: { csrfToken, email, password, callbackUrl: '/' },
    headers: { 'X-Auth-Return-Redirect': '1' },
  })
  const { url } = await res.json()
  if (String(url).includes('error=')) throw new Error(`Sign-in failed for ${email}: ${url}`)
}

export async function signOut(page: Page): Promise<void> {
  const { csrfToken } = await (await page.request.get('/api/auth/csrf')).json()
  await page.request.post('/api/auth/signout', { form: { csrfToken, callbackUrl: '/' } })
}

/** Fills a field the way a user types it (React sees the input events). */
export async function fill(page: Page, name: string, value: string): Promise<void> {
  await page.locator(`input[name="${name}"]`).fill(value)
}

// Playwright loads specs as CommonJS, so __dirname (apps/web/e2e/support) is available.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

/**
 * Takes an evidence screenshot. Always attached to the HTML report; with
 * EVIDENCE=1 it is also written to docs/test-evidence/web/<area>/<name>.jpg,
 * the committed set linked from the testing issues.
 */
export async function snap(
  page: Page,
  testInfo: TestInfo,
  area: string,
  name: string,
  options: { fullPage?: boolean } = {}
): Promise<void> {
  // Images (pitch photos) and fonts settle before the picture is taken —
  // bounded, since a page that polls never goes fully idle.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  const body = await page.screenshot({
    fullPage: options.fullPage ?? false,
    animations: 'disabled',
  })
  await testInfo.attach(`${area}/${name}`, { body, contentType: 'image/png' })
  if (process.env.EVIDENCE) {
    // JPEG keeps the committed set small; the report keeps the PNG.
    const file = join(REPO_ROOT, 'docs', 'test-evidence', 'web', area, `${name}.jpg`)
    mkdirSync(dirname(file), { recursive: true })
    await page.screenshot({
      path: file,
      type: 'jpeg',
      quality: 80,
      fullPage: options.fullPage ?? false,
      animations: 'disabled',
    })
  }
}

/**
 * The page's own alert. Scoped to the form because Next.js renders a hidden
 * `role="alert"` route announcer on every page.
 */
export const formAlert = (page: Page) => page.locator('form').getByRole('alert')

/** The phone width used for small-screen checks (UIUX_SPEC: 375). */
export const PHONE = { width: 375, height: 812 }
