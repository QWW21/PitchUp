/**
 * Auth API — T-04. Every E02 security decision recorded in docs/HANDOVER.md
 * has a case here: no enumeration, refresh rotation, reuse detection, Bearer
 * auth (#177), sessions ended on reset (#176).
 */
import { expect, test } from '@playwright/test'
import { get, post } from '../support/api'
import {
  createPlayer,
  createResetToken,
  db,
  setVerificationCode,
  uniqueEmail,
  uniquePhone,
} from '../support/db'
import { resetRateLimits } from '../support/helpers'

const PASSWORD = 'Testing123'

const player = (email: string, phone = uniquePhone()) => ({
  name: 'E2E Player',
  email,
  phone,
  password: PASSWORD,
  city: 'Cluj-Napoca',
  dateOfBirth: '1995-05-05',
})

interface Tokens {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string }
}

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request)
})

test.describe('registration', () => {
  test('rejects an invalid body with field errors', async ({ request }) => {
    const r = await post(request, '/auth/register', { ...player('not-an-email'), password: 'weak' })
    expect(r.status).toBe(400)
    expect(r.error?.code).toBe('VALIDATION_ERROR')
  })

  test('creates an unverified player', async ({ request }) => {
    const email = uniqueEmail('reg')
    const r = await post(request, '/auth/register', player(email))
    expect(r.status).toBe(201)
    const user = await db.user.findUniqueOrThrow({ where: { email } })
    expect(user).toMatchObject({ role: 'PLAYER', emailVerified: false, phoneVerified: false })
    expect(user.passwordHash).not.toContain(PASSWORD)
    // The phone is verified later, from the profile: no text at sign-up (#163).
    expect(await db.verificationCode.count({ where: { userId: user.id, channel: 'PHONE' } })).toBe(
      0
    )
  })

  test('answers an existing email exactly like a new one (no enumeration)', async ({ request }) => {
    const fresh = await post(request, '/auth/register', player(uniqueEmail('reg')))
    const taken = await post(request, '/auth/register', player('player@demo.ro'))
    expect(taken.status).toBe(fresh.status)
    expect(taken.data).toEqual(fresh.data)
  })

  test('refuses a phone number that a verified account already uses', async ({ request }) => {
    const r = await post(request, '/auth/register', player(uniqueEmail('reg'), '+40700000002'))
    expect(r.status).toBe(409)
    expect(r.error?.details).toEqual({ field: 'phone' })
  })

  test('limits attempts per IP, counting only valid requests', async ({ request }) => {
    // Junk does not spend the budget…
    for (let i = 0; i < 5; i++) {
      expect((await post(request, '/auth/register', { email: 'junk' })).status).toBe(400)
    }
    // …so three real attempts still go through, and the fourth is limited.
    for (let i = 0; i < 3; i++) {
      expect((await post(request, '/auth/register', player(uniqueEmail('rl')))).status).toBe(201)
    }
    expect((await post(request, '/auth/register', player(uniqueEmail('rl')))).status).toBe(429)
  })

  test('manager registration creates a MANAGER', async ({ request }) => {
    const email = uniqueEmail('mgr')
    const r = await post(request, '/auth/register/manager', {
      name: 'E2E Manager',
      email,
      phone: uniquePhone(),
      password: PASSWORD,
    })
    expect(r.status).toBe(201)
    expect((await db.user.findUniqueOrThrow({ where: { email } })).role).toBe('MANAGER')
  })
})

test.describe('email verification', () => {
  test('wrong code, then the right one, then login works', async ({ request }) => {
    const email = uniqueEmail('verify')
    await post(request, '/auth/register', player(email))
    await setVerificationCode(email, '123456')

    const wrong = await post(request, '/auth/verify-email', { email, code: '000000' })
    expect(wrong.status).toBe(400)
    expect(wrong.error?.message).toBe('That code is not correct')

    const right = await post(request, '/auth/verify-email', { email, code: '123456' })
    expect(right.status).toBe(200)
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true)

    const used = await post(request, '/auth/verify-email', { email, code: '123456' })
    expect(used.status).toBe(400)
  })

  test('burns the code after three wrong guesses', async ({ request }) => {
    const email = uniqueEmail('burn')
    await post(request, '/auth/register', player(email))
    await setVerificationCode(email, '654321')
    for (let i = 0; i < 3; i++) await post(request, '/auth/verify-email', { email, code: '111111' })
    const r = await post(request, '/auth/verify-email', { email, code: '654321' })
    expect(r.status).toBe(400)
    expect(r.error?.message).toMatch(/too many|expired|not correct/i)
  })

  test('resend answers the same for any address', async ({ request }) => {
    const known = await post(request, '/auth/resend-code', {
      email: 'player@demo.ro',
      channel: 'EMAIL',
    })
    const unknown = await post(request, '/auth/resend-code', {
      email: 'nobody@e2e.test',
      channel: 'EMAIL',
    })
    expect(known.status).toBe(200)
    expect(unknown.data).toEqual(known.data)
  })
})

test.describe('phone verification', () => {
  const registered = async (request: Parameters<typeof post>[0], code: string) => {
    const email = uniqueEmail('phone')
    await post(request, '/auth/register', player(email))
    await setVerificationCode(email, code, 'PHONE')
    return email
  }

  test('wrong code counts down, the right one verifies, and it works once', async ({ request }) => {
    const email = await registered(request, '246810')

    const wrong = await post(request, '/auth/verify-phone', { email, code: '000000' })
    expect(wrong.status).toBe(400)
    expect(wrong.error?.details).toEqual({ reason: 'INVALID_CODE', attemptsRemaining: 2 })

    const right = await post(request, '/auth/verify-phone', { email, code: '246810' })
    expect(right.status).toBe(200)
    expect(right.data).toEqual({ verified: true })
    const user = await db.user.findUniqueOrThrow({ where: { email } })
    expect(user).toMatchObject({ phoneVerified: true, emailVerified: false })

    const reused = await post(request, '/auth/verify-phone', { email, code: '246810' })
    expect(reused.status).toBe(400)
  })

  test('an emailed code cannot verify the phone, nor a texted one the email', async ({
    request,
  }) => {
    const email = uniqueEmail('channel')
    await post(request, '/auth/register', player(email))
    await setVerificationCode(email, '111222', 'EMAIL')
    await setVerificationCode(email, '333444', 'PHONE')

    expect((await post(request, '/auth/verify-phone', { email, code: '111222' })).status).toBe(400)
    expect((await post(request, '/auth/verify-email', { email, code: '333444' })).status).toBe(400)
    const user = await db.user.findUniqueOrThrow({ where: { email } })
    expect(user).toMatchObject({ phoneVerified: false, emailVerified: false })
  })

  test('an expired code answers 410', async ({ request }) => {
    const email = await registered(request, '135790')
    const user = await db.user.findUniqueOrThrow({ where: { email } })
    await db.verificationCode.updateMany({
      where: { userId: user.id, channel: 'PHONE', usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const r = await post(request, '/auth/verify-phone', { email, code: '135790' })
    expect(r.status).toBe(410)
    expect(r.error?.details).toEqual({ reason: 'CODE_EXPIRED' })
  })

  test('the third wrong guess burns the code, even for the right one after', async ({
    request,
  }) => {
    const email = await registered(request, '975310')
    const remaining = []
    for (let i = 0; i < 3; i++) {
      const r = await post(request, '/auth/verify-phone', { email, code: '000000' })
      remaining.push([
        r.status,
        (r.error?.details as { attemptsRemaining?: number } | undefined)?.attemptsRemaining,
      ])
    }
    expect(remaining).toEqual([
      [400, 2],
      [400, 1],
      [429, 0],
    ])
    const r = await post(request, '/auth/verify-phone', { email, code: '975310' })
    expect(r.status).toBe(429)
    expect(r.error?.details).toEqual({ reason: 'TOO_MANY_ATTEMPTS' })
  })

  test('an unknown address gets a plain wrong-code answer with no count', async ({ request }) => {
    const r = await post(request, '/auth/verify-phone', {
      email: 'nobody@e2e.test',
      code: '123456',
    })
    expect(r.status).toBe(400)
    expect(r.error?.details).toEqual({ reason: 'INVALID_CODE' })
  })

  test('a code that is not six digits is a validation error', async ({ request }) => {
    const r = await post(request, '/auth/verify-phone', { email: 'player@demo.ro', code: '12a' })
    expect(r.status).toBe(400)
    expect(r.error?.code).toBe('VALIDATION_ERROR')
  })

  test('resending an SMS answers the same for any address', async ({ request }) => {
    const known = await post(request, '/auth/resend-code', {
      email: await registered(request, '102030'),
      channel: 'PHONE',
    })
    const unknown = await post(request, '/auth/resend-code', {
      email: 'nobody@e2e.test',
      channel: 'PHONE',
    })
    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(unknown.data).toEqual(known.data)
  })
})

test.describe('mobile login, refresh and logout', () => {
  test('one error for a wrong password, an unknown email and an unverified account', async ({
    request,
  }) => {
    const unverified = uniqueEmail('unv')
    await post(request, '/auth/register', player(unverified))

    const answers = await Promise.all([
      post(request, '/auth/mobile/login', { email: 'player@demo.ro', password: 'WrongPass1' }),
      post(request, '/auth/mobile/login', { email: 'nobody@e2e.test', password: PASSWORD }),
      post(request, '/auth/mobile/login', { email: unverified, password: PASSWORD }),
    ])
    for (const a of answers) {
      expect(a.status).toBe(401)
      expect(a.error).toEqual({ code: 'UNAUTHORIZED', message: 'Incorrect email or password' })
    }
  })

  test('returns a token pair and a user on success', async ({ request }) => {
    const r = await post<Tokens>(request, '/auth/mobile/login', {
      email: 'player@demo.ro',
      password: 'Player1234!',
    })
    expect(r.status).toBe(200)
    expect(r.data?.accessToken).toMatch(/^ey/)
    expect(r.data?.refreshToken).toMatch(/^[a-f0-9]{64}$/)
    expect(r.data?.user.email).toBe('player@demo.ro')
  })

  test('refresh rotates, and reusing an old token ends every session', async ({ request }) => {
    const login = (
      await post<Tokens>(request, '/auth/mobile/login', {
        email: 'player@demo.ro',
        password: 'Player1234!',
      })
    ).data!
    const first = await post<Tokens>(request, '/auth/mobile/refresh', {
      refreshToken: login.refreshToken,
    })
    expect(first.status).toBe(200)
    expect(first.data!.refreshToken).not.toBe(login.refreshToken)

    // The original token was rotated away; presenting it again looks like theft.
    const reuse = await post(request, '/auth/mobile/refresh', { refreshToken: login.refreshToken })
    expect(reuse.status).toBe(401)
    // …and the legitimate successor dies with it.
    const successor = await post(request, '/auth/mobile/refresh', {
      refreshToken: first.data!.refreshToken,
    })
    expect(successor.status).toBe(401)
  })

  test('logout revokes the refresh token and never reveals whether it existed', async ({
    request,
  }) => {
    const login = (
      await post<Tokens>(request, '/auth/mobile/login', {
        email: 'player@demo.ro',
        password: 'Player1234!',
      })
    ).data!
    const out = await post(request, '/auth/logout', { refreshToken: login.refreshToken })
    const bogus = await post(request, '/auth/logout', { refreshToken: 'not-a-real-token' })
    expect(out.status).toBe(200)
    expect(bogus.data).toEqual(out.data)
    expect(
      (await post(request, '/auth/mobile/refresh', { refreshToken: login.refreshToken })).status
    ).toBe(401)
  })
})

test.describe('/me', () => {
  test('accepts the mobile Bearer token (#177)', async ({ request }) => {
    const login = (
      await post<Tokens>(request, '/auth/mobile/login', {
        email: 'player@demo.ro',
        password: 'Player1234!',
      })
    ).data!
    const me = await get<{ email: string; trustScore: number }>(request, '/me', {
      Authorization: `Bearer ${login.accessToken}`,
    })
    expect(me.status).toBe(200)
    expect(me.data).toMatchObject({ email: 'player@demo.ro', role: 'PLAYER', trustScore: 100 })
  })

  test('refuses a bad token and no credentials', async ({ request }) => {
    expect((await get(request, '/me', { Authorization: 'Bearer not.a.token' })).status).toBe(401)
    expect((await get(request, '/me')).status).toBe(401)
  })

  test('stops honouring a token once the account is deleted', async ({ request }) => {
    const email = uniqueEmail('del')
    await post(request, '/auth/register', player(email))
    await db.user.update({ where: { email }, data: { emailVerified: true } })
    const login = (await post<Tokens>(request, '/auth/mobile/login', { email, password: PASSWORD }))
      .data!
    await db.user.update({ where: { email }, data: { deletedAt: new Date() } })
    expect(
      (await get(request, '/me', { Authorization: `Bearer ${login.accessToken}` })).status
    ).toBe(401)
  })
})

test.describe('password reset', () => {
  test('forgot-password answers the same for any address', async ({ request }) => {
    const known = await post(request, '/auth/forgot-password', { email: 'player@demo.ro' })
    const unknown = await post(request, '/auth/forgot-password', { email: 'nobody@e2e.test' })
    expect(known.status).toBe(200)
    expect(unknown.data).toEqual(known.data)
  })

  test('a reset changes the password, works once, and revokes mobile sessions', async ({
    request,
  }) => {
    const email = uniqueEmail('reset')
    await post(request, '/auth/register', player(email))
    await db.user.update({ where: { email }, data: { emailVerified: true } })
    const login = (await post<Tokens>(request, '/auth/mobile/login', { email, password: PASSWORD }))
      .data!

    const token = await createResetToken(email)
    expect((await post(request, '/auth/reset-password', { token, password: 'weak' })).status).toBe(
      400
    )
    expect(
      (await post(request, '/auth/reset-password', { token, password: 'Changed123' })).status
    ).toBe(200)
    expect(
      (await post(request, '/auth/reset-password', { token, password: 'Another123' })).status
    ).toBe(400)

    expect((await post(request, '/auth/mobile/login', { email, password: PASSWORD })).status).toBe(
      401
    )
    expect(
      (await post(request, '/auth/mobile/login', { email, password: 'Changed123' })).status
    ).toBe(200)
    expect(
      (await post(request, '/auth/mobile/refresh', { refreshToken: login.refreshToken })).status
    ).toBe(401)
    expect((await db.user.findUniqueOrThrow({ where: { email } })).passwordChangedAt).not.toBeNull()
  })

  test('rejects a malformed or unknown token', async ({ request }) => {
    expect(
      (await post(request, '/auth/reset-password', { token: 'abc', password: 'Changed123' })).status
    ).toBe(400)
    const unknown = await post(request, '/auth/reset-password', {
      token: 'a'.repeat(64),
      password: 'Changed123',
    })
    expect(unknown.status).toBe(400)
    expect(unknown.error?.message).toBe('That reset link is not valid')
  })
})

test.describe('Google sign-in (E02-07)', () => {
  test('refuses a token Google did not sign for us', async ({ request }) => {
    const forged = ['eyJhbGciOiJSUzI1NiIsImtpZCI6ImsxIn0', 'eyJlbWFpbCI6ImFAYi5jIn0', 'c2ln'].join(
      '.'
    )
    const r = await post(request, '/auth/mobile/google', { idToken: forged })
    expect(r.status).toBe(401)
    expect(r.error?.code).toBe('UNAUTHORIZED')
  })

  test('checks the sign-up details before anything else', async ({ request }) => {
    const r = await post(request, '/auth/mobile/google', {
      idToken: 'x'.repeat(40),
      profile: { phone: '0711', city: '', dateOfBirth: 'yesterday' },
    })
    expect(r.status).toBe(400)
    expect(r.error?.code).toBe('VALIDATION_ERROR')
  })
})

/**
 * #188: the client IP is the X-Forwarded-For entry TRUSTED_PROXY_HOPS (1 on
 * this server) from the right, and failed sign-ins are also limited per
 * address: 10 per 15 minutes, web and mobile together.
 */
test.describe('client IP and the per-account login limit (#188)', () => {
  const WRONG = 'WrongPass1'
  let ipSeq = 0
  /** A fresh rightmost entry, so no per-IP limit ever applies. */
  const nextIp = () => {
    ipSeq += 1
    return `10.188.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`
  }
  const login = (request: Parameters<typeof post>[0], email: string, password: string) =>
    post<Tokens>(
      request,
      '/auth/mobile/login',
      { email, password },
      { 'X-Forwarded-For': nextIp() }
    )
  const failTen = async (request: Parameters<typeof post>[0], email: string) => {
    for (let i = 0; i < 10; i++) await login(request, email, WRONG)
  }

  test('AC5: register is limited on the rightmost entry, whatever the client puts left', async ({
    request,
  }) => {
    const statuses = []
    let last
    for (let i = 1; i <= 4; i++) {
      last = await post(request, '/auth/register', player(uniqueEmail('xff-reg')), {
        'X-Forwarded-For': `203.0.113.${i}, 198.51.100.7`,
      })
      statuses.push(last.status)
    }
    expect(statuses).toEqual([201, 201, 201, 429])
    expect(last?.error?.code).toBe('RATE_LIMITED')
  })

  test('AC6: mobile login is limited per IP on the rightmost entry', async ({ request }) => {
    const statuses = []
    let last
    for (let i = 1; i <= 6; i++) {
      last = await post(
        request,
        '/auth/mobile/login',
        { email: uniqueEmail('xff-login'), password: WRONG },
        { 'X-Forwarded-For': `203.0.113.${i}, 198.51.100.8` }
      )
      statuses.push(last.status)
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429])
    expect(last?.error?.code).toBe('RATE_LIMITED')
  })

  test('AC8: after 10 wrong passwords even the right one is refused with 429', async ({
    request,
  }) => {
    const email = uniqueEmail('acct-lock')
    await createPlayer(email, PASSWORD)
    for (let i = 0; i < 10; i++) expect((await login(request, email, WRONG)).status).toBe(401)

    const r = await login(request, email, PASSWORD)
    expect(r.status).toBe(429)
    expect(r.error?.code).toBe('RATE_LIMITED')
    const details = r.error?.details as { retryAfterSeconds?: number } | undefined
    expect(details?.retryAfterSeconds).toBeGreaterThan(0)
  })

  test('AC9: the count ignores case and surrounding spaces', async ({ request }) => {
    const email = uniqueEmail('acct-case')
    await createPlayer(email, PASSWORD)
    const upper = email[0]!.toUpperCase() + email.slice(1)
    const variants = [upper, ` ${email}`, email]
    for (let i = 0; i < 10; i++) await login(request, variants[i % 3]!, WRONG)

    const r = await login(request, email, PASSWORD)
    expect(r.status).toBe(429)
    expect(r.error?.code).toBe('RATE_LIMITED')
  })

  test('AC10: an address with no account is throttled exactly like a real one', async ({
    request,
  }) => {
    const real = uniqueEmail('acct-real')
    await createPlayer(real, PASSWORD)
    const nobody = uniqueEmail('acct-nobody')
    await failTen(request, real)
    await failTen(request, nobody)

    const a = await login(request, real, WRONG)
    const b = await login(request, nobody, WRONG)
    expect(a.status).toBe(429)
    expect(b.status).toBe(a.status)
    expect(b.error?.code).toBe(a.error?.code)
    expect(Object.keys((b.error?.details ?? {}) as object).sort()).toEqual(
      Object.keys((a.error?.details ?? {}) as object).sort()
    )
  })

  test("AC11: one address's failures do not throttle another", async ({ request }) => {
    const a = uniqueEmail('acct-a')
    const b = uniqueEmail('acct-b')
    await createPlayer(a, PASSWORD)
    await createPlayer(b, PASSWORD)
    await failTen(request, a)

    expect((await login(request, a, PASSWORD)).status).toBe(429)
    expect((await login(request, b, PASSWORD)).status).toBe(200)
  })

  test('AC12: successful logins are not counted', async ({ request }) => {
    const email = uniqueEmail('acct-ok')
    await createPlayer(email, PASSWORD)
    const statuses = []
    for (let i = 0; i < 11; i++) statuses.push((await login(request, email, PASSWORD)).status)
    expect(statuses).toEqual(Array(11).fill(200))
  })

  test('wrong passwords sent all at once cannot get past the limit', async ({ request }) => {
    const email = uniqueEmail('acct-burst')
    await createPlayer(email, PASSWORD)
    const results = await Promise.all(
      Array.from({ length: 15 }, () => login(request, email, WRONG))
    )
    const statuses = results.map(r => r.status)
    expect(statuses.filter(s => s === 401).length).toBeLessThanOrEqual(10)
    expect(statuses.filter(s => s === 429).length).toBeGreaterThanOrEqual(5)
    expect(statuses.every(s => s === 401 || s === 429)).toBe(true)
  })
})

/**
 * #211: the right password on an unverified account answers like a wrong
 * one, and re-sends the code while the address's email quota (5 an hour)
 * allows. Once the quota is used up the send is skipped quietly: still the
 * same 401, never a 500 that would reveal the account exists.
 */
test.describe('mobile login on an unverified account (#211)', () => {
  const INVALID = { code: 'UNAUTHORIZED', message: 'Incorrect email or password' }
  let ipSeq = 0
  /** A fresh rightmost X-Forwarded-For entry, so the per-IP limit (5/15 min) never applies. */
  const nextIp = () => {
    ipSeq += 1
    return `10.211.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`
  }
  const login = (request: Parameters<typeof post>[0], email: string, password: string) =>
    post(request, '/auth/mobile/login', { email, password }, { 'X-Forwarded-For': nextIp() })

  /** Made in the database, so no verification email has used the quota yet. */
  const createUnverified = async (email: string) => {
    await createPlayer(email, PASSWORD)
    await db.user.update({ where: { email }, data: { emailVerified: false } })
  }
  const emailCodes = (email: string) =>
    db.verificationCode.count({ where: { user: { email }, channel: 'EMAIL' } })

  test('AC1: the right password answers like a wrong one, also after the email quota is used up', async ({
    request,
  }) => {
    const email = uniqueEmail('unv-quota')
    await createUnverified(email)

    const wrong = await login(request, email, 'WrongPass1')
    expect(wrong.status).toBe(401)
    expect(wrong.error).toEqual(INVALID)

    const answers = []
    for (let i = 0; i < 7; i++) {
      const r = await login(request, email, PASSWORD)
      answers.push({ status: r.status, error: r.error })
    }
    expect(answers).toEqual(Array(7).fill({ status: 401, error: INVALID }))
  })

  test('AC2: once the quota is used up, an address with no account gets the identical 401', async ({
    request,
  }) => {
    const email = uniqueEmail('unv-compare')
    await createUnverified(email)
    for (let i = 0; i < 5; i++) await login(request, email, PASSWORD)

    const sixth = await login(request, email, PASSWORD)
    const nobody = await login(request, uniqueEmail('unv-nobody'), PASSWORD)
    expect(nobody.status).toBe(401)
    expect(sixth.status).toBe(nobody.status)
    expect(sixth.error?.code).toBe(nobody.error?.code)
    expect(sixth.error?.message).toBe(nobody.error?.message)
    expect(sixth.error).toEqual(nobody.error)
  })

  test('AC3: a fresh code is emailed on each such login while the quota allows', async ({
    request,
  }) => {
    const email = uniqueEmail('unv-resend')
    await createUnverified(email)
    expect(await emailCodes(email)).toBe(0)

    for (let i = 1; i <= 5; i++) {
      expect((await login(request, email, PASSWORD)).status).toBe(401)
      expect(await emailCodes(email)).toBe(i)
    }
    // Only the newest code is live: each send supersedes the one before.
    expect(
      await db.verificationCode.count({
        where: { user: { email }, channel: 'EMAIL', usedAt: null },
      })
    ).toBe(1)

    // The 6th is over the quota: answered the same, with nothing sent.
    expect((await login(request, email, PASSWORD)).status).toBe(401)
    expect(await emailCodes(email)).toBe(5)
  })
})
