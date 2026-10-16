/**
 * Web auth flows in a real browser — T-06. Each meaningful state is captured
 * with snap() as evidence (docs/test-evidence/web/auth with EVIDENCE=1).
 */
import { expect, test, type Page } from '@playwright/test'
import { createResetToken, db, setVerificationCode, uniqueEmail, uniquePhone } from '../support/db'
import { PHONE, fill, formAlert, resetRateLimits, signIn, snap } from '../support/helpers'

const AREA = 'auth'

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

async function loginWithForm(page: Page, email: string, password: string) {
  await fill(page, 'email', email)
  await fill(page, 'password', password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test.describe('login', () => {
  test('wrong password shows the error and resets the button (#159)', async ({ page }, info) => {
    await page.goto('/login')
    await snap(page, info, AREA, '01-login')
    await loginWithForm(page, 'player@demo.ro', 'WrongPass123')
    await expect(formAlert(page)).toHaveText('Incorrect email or password.')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled()
    await expect(page).toHaveURL(/\/login$/)
    await snap(page, info, AREA, '02-login-wrong-password')
  })

  test('an unknown email gets exactly the same message', async ({ page }) => {
    await page.goto('/login')
    await loginWithForm(page, 'nobody@e2e.test', 'Whatever123')
    await expect(formAlert(page)).toHaveText('Incorrect email or password.')
  })

  test('an unverified account is refused the same way and sent a new code', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('web-unverified')
    await request.post('/api/v1/auth/register/manager', {
      data: { name: 'Web Unverified', email, phone: uniquePhone(), password: 'Testing123' },
    })
    const before = await db.verificationCode.count({ where: { user: { email } } })
    await page.goto('/login')
    await loginWithForm(page, email, 'Testing123')
    await expect(formAlert(page)).toHaveText('Incorrect email or password.')
    await expect(page.getByText('we have sent a new code')).toBeVisible()
    await expect
      .poll(() => db.verificationCode.count({ where: { user: { email } } }))
      .toBeGreaterThan(before)
  })

  test('a manager signs in to the dashboard', async ({ page }, info) => {
    await page.goto('/login')
    await loginWithForm(page, 'manager@demo.ro', 'Manager1234!')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByText('Signed in as manager@demo.ro')).toBeVisible()
    await snap(page, info, AREA, '03-dashboard')
  })

  test('a player signs in to Discover', async ({ page }, info) => {
    await page.goto('/login')
    await loginWithForm(page, 'player@demo.ro', 'Player1234!')
    await expect(page).toHaveURL(/\/discover/)
    await snap(page, info, AREA, '04-player-lands-on-discover')
  })

  test('"Sign in" in the top bar takes a manager to the dashboard, a player to Discover', async ({
    page,
  }) => {
    // The top bar used to send everyone back to /discover, managers included.
    await page.goto('/discover?city=Cluj-Napoca')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await loginWithForm(page, 'venue-gheorgheni@demo.ro', 'Player1234!')
    await expect(page).toHaveURL(/\/dashboard$/)

    // A manager browsing Discover can get back to the dashboard from the menu.
    await page.goto('/discover?city=Cluj-Napoca')
    await page.getByRole('button', { name: /Account menu/ }).click()
    await page.getByRole('menuitem', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.context().clearCookies()
    await page.goto('/discover?city=Cluj-Napoca')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await loginWithForm(page, 'player@demo.ro', 'Player1234!')
    await expect(page).toHaveURL(/\/discover/)
    await page.getByRole('button', { name: /Account menu/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Dashboard' })).toHaveCount(0)
  })

  test('callbackUrl returns to the page that asked', async ({ page }) => {
    await page.goto('/login?callbackUrl=%2Fdiscover%3Fcity%3DIa%C8%99i')
    await loginWithForm(page, 'manager@demo.ro', 'Manager1234!')
    await expect(page).toHaveURL(/\/discover\?city=Ia%C8%99i$/)
  })

  test('callbackUrl cannot send the user to another site (#172)', async ({ page }) => {
    await page.goto('/login?callbackUrl=%2F%2Fexample.com')
    await loginWithForm(page, 'manager@demo.ro', 'Manager1234!')
    await expect(page).toHaveURL(/localhost:\d+\/dashboard$/)
  })

  test('signed-in visitors skip /login and /', async ({ page }) => {
    await signIn(page, 'manager@demo.ro', 'Manager1234!')
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('the login page fits a phone', async ({ page }, info) => {
    await page.setViewportSize(PHONE)
    await page.goto('/login')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '05-login-phone')
  })
})

test.describe('sign out and protected pages', () => {
  test('/dashboard sends a signed-out visitor to login, with the way back', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard$/)
  })

  test('sign out from the dashboard', async ({ page }) => {
    await signIn(page, 'manager@demo.ro', 'Manager1234!')
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?callbackUrl/)
  })

  test('sign out from the player menu', async ({ page }, info) => {
    await signIn(page, 'player@demo.ro', 'Player1234!')
    await page.goto('/discover?city=Cluj-Napoca')
    await page.getByRole('button', { name: /Account menu/ }).click()
    await expect(page.getByRole('menuitem', { name: 'Logout' })).toBeVisible()
    await snap(page, info, AREA, '06-player-menu')
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  })
})

test.describe('manager registration', () => {
  test('validation errors appear under the fields', async ({ page }, info) => {
    await page.goto('/register')
    await snap(page, info, AREA, '07-register')
    await page.getByRole('button', { name: /Create account/ }).click()
    await expect(page.getByText('Enter your full name')).toBeVisible()
    await expect(page.getByText('Invalid email')).toBeVisible()
    await fill(page, 'password', 'Testing123')
    await fill(page, 'confirmPassword', 'Testing124')
    await page.getByRole('button', { name: /Create account/ }).click()
    await expect(page.getByText('Passwords do not match')).toBeVisible()
    await snap(page, info, AREA, '08-register-errors')
  })

  test('register → verify (wrong code, resend, right code) → confirmed → sign in', async ({
    page,
  }, info) => {
    const email = uniqueEmail('web-register')
    await page.goto('/register')
    await fill(page, 'name', 'Web Manager')
    await fill(page, 'email', email)
    // Typed in full: must not become +4040… (#174).
    await fill(page, 'phone', '+40 79 123 4567')
    await fill(page, 'password', 'Testing123')
    await fill(page, 'confirmPassword', 'Testing123')
    await page.getByRole('button', { name: /Create account/ }).click()
    await expect(page).toHaveURL(/\/verify-email\?email=/)
    expect((await db.user.findUniqueOrThrow({ where: { email } })).phone).toBe('+40791234567')
    await snap(page, info, AREA, '09-verify-email')

    await setVerificationCode(email, '246810')
    await fill(page, 'code', '000000')
    await page.getByRole('button', { name: 'Verify email' }).click()
    await expect(formAlert(page)).toContainText('That code is not correct')
    await snap(page, info, AREA, '10-verify-wrong-code')

    await page.getByRole('button', { name: 'Send a new code' }).click()
    await expect(page.getByRole('status')).toContainText('a new code is on its way')
    await setVerificationCode(email, '246810')
    await fill(page, 'code', '246810')
    await page.getByRole('button', { name: 'Verify email' }).click()
    await expect(page).toHaveURL(/\/registration-confirmed/)
    await snap(page, info, AREA, '11-registration-confirmed')

    await page.getByRole('link', { name: 'Go to sign in' }).click()
    await expect(page.locator('input[name="email"]')).toHaveValue(email)
    await fill(page, 'password', 'Testing123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('registration fits a phone', async ({ page }, info) => {
    await page.setViewportSize(PHONE)
    await page.goto('/register')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      PHONE.width
    )
    await snap(page, info, AREA, '12-register-phone')
  })
})

test.describe('password reset', () => {
  test('forgot password answers without revealing the account', async ({ page }, info) => {
    await page.goto('/forgot-password')
    await fill(page, 'email', 'nobody@e2e.test')
    await page.getByRole('button', { name: 'Send reset link' }).click()
    await expect(page.getByText('is registered, a reset link is on its way')).toBeVisible()
    await snap(page, info, AREA, '13-forgot-password-sent')
  })

  test('a broken link offers a new one', async ({ page }, info) => {
    await page.goto('/reset-password?token=garbage')
    await expect(page.getByText('This reset link is not valid')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Request a new link' })).toBeVisible()
    await snap(page, info, AREA, '14-reset-bad-link')
  })

  test('reset: weak and mismatched passwords, success, link reused, old password refused', async ({
    page,
    request,
  }, info) => {
    const email = uniqueEmail('web-reset')
    await request.post('/api/v1/auth/register/manager', {
      data: { name: 'Web Reset', email, phone: uniquePhone(), password: 'Testing123' },
    })
    await db.user.update({ where: { email }, data: { emailVerified: true } })
    const token = await createResetToken(email)

    await page.goto(`/reset-password?token=${token}`)
    await snap(page, info, AREA, '15-reset-form')
    await fill(page, 'password', 'weak')
    await fill(page, 'confirmPassword', 'weak')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Must be at least 8 characters')).toBeVisible()
    await fill(page, 'password', 'Changed123')
    await fill(page, 'confirmPassword', 'Changed124')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Passwords do not match')).toBeVisible()
    await snap(page, info, AREA, '16-reset-errors')

    await fill(page, 'confirmPassword', 'Changed123')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Your password has been changed')).toBeVisible()
    await snap(page, info, AREA, '17-reset-success')

    await page.goto(`/reset-password?token=${token}`)
    await fill(page, 'password', 'Another123')
    await fill(page, 'confirmPassword', 'Another123')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('That reset link is not valid')).toBeVisible()

    await page.goto('/login')
    await loginWithForm(page, email, 'Testing123')
    await expect(formAlert(page)).toHaveText('Incorrect email or password.')
    await loginWithForm(page, email, 'Changed123')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('a reset signs out a browser that was already signed in (#176)', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('web-session')
    await request.post('/api/v1/auth/register/manager', {
      data: { name: 'Web Session', email, phone: uniquePhone(), password: 'Testing123' },
    })
    await db.user.update({ where: { email }, data: { emailVerified: true } })
    await signIn(page, email, 'Testing123')
    await page.goto('/dashboard')
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()

    const token = await createResetToken(email)
    await request.post('/api/v1/auth/reset-password', { data: { token, password: 'Changed123' } })

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})
