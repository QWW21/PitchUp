/**
 * #211: the mobile login's re-send of a verification code. The right
 * password on an unverified account answers INVALID_CREDENTIALS (a 401 at
 * the route) whatever happens to the email: a failing provider is logged,
 * a used-up quota is skipped quietly, and neither escapes as a 500.
 */
import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetRateLimits } from '@/lib/api/rate-limit'
import { loginWithPassword } from './service'

const PASSWORD = 'Testing123'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  verificationCode: {
    updateMany: vi.fn(async () => ({ count: 0 })),
    create: vi.fn(async () => ({})),
  },
  refreshToken: { create: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

/** The fake email provider; each test decides whether it works or throws. */
const emailProvider = vi.hoisted(() => ({ name: 'fake', send: vi.fn(async () => undefined) }))
vi.mock('@/lib/notifications', () => ({
  getEmailProvider: () => emailProvider,
  getSmsProvider: () => ({ name: 'fake-sms', send: vi.fn() }),
  isTwilioVerifyConfigured: () => false,
  twilioVerify: { start: vi.fn(), check: vi.fn() },
}))
vi.mock('@/i18n/server', () => ({ userLocale: () => 'en' }))

const passwordHash = bcrypt.hashSync(PASSWORD, 4)
let seq = 0

/** An unverified account behind every user lookup, with a fresh address per test. */
function unverifiedUser() {
  seq += 1
  const user = {
    id: `user-${seq}`,
    email: `unverified-${seq}@unit.test`,
    name: 'Unverified',
    role: 'PLAYER',
    passwordHash,
    emailVerified: false,
    deletedAt: null,
    suspendedAt: null,
    locale: 'en',
  }
  prismaMock.user.findUnique.mockResolvedValue(user)
  return user
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimits()
  emailProvider.send.mockResolvedValue(undefined)
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => consoleError.mockRestore())

describe('loginWithPassword on an unverified account (#211)', () => {
  it('AC4: an email-provider failure is logged and answered as invalid credentials', async () => {
    const user = unverifiedUser()
    const outage = new Error('Email provider is down')
    emailProvider.send.mockRejectedValue(outage)

    await expect(loginWithPassword(user.email, PASSWORD)).resolves.toEqual({
      failure: 'INVALID_CREDENTIALS',
    })
    expect(emailProvider.send).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalled()
    expect(consoleError.mock.calls.flat()).toContain(outage)
  })

  it('AC4: a used-up email quota is skipped quietly, not logged as an error', async () => {
    const user = unverifiedUser()
    const results = []
    for (let i = 0; i < 6; i++) results.push(await loginWithPassword(user.email, PASSWORD))

    expect(results).toEqual(Array(6).fill({ failure: 'INVALID_CREDENTIALS' }))
    // The quota is 5 an hour: the 6th send never reaches the provider.
    expect(emailProvider.send).toHaveBeenCalledTimes(5)
    expect(consoleError).not.toHaveBeenCalled()
  })
})
