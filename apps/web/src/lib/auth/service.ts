/**
 * Authentication logic — ticket E02-08.
 *
 * Kept out of the route handlers so the rules can be tested directly and
 * reused by both the mobile JWT routes and the NextAuth credentials
 * provider.
 */
import 'server-only'
import bcrypt from 'bcryptjs'
import type { Role, User } from '@prisma/client'
import { AUTH, type RegisterManagerInput, type RegisterPlayerInput } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import {
  ACCOUNT_LOGIN_RATE_LIMIT,
  EMAIL_PER_ADDRESS_RATE_LIMIT,
  PASSWORD_RESET_RATE_LIMIT,
  SMS_PER_PHONE_RATE_LIMIT,
  checkRateLimit,
  refundRateLimit,
} from '@/lib/api/rate-limit'
import {
  getEmailProvider,
  getSmsProvider,
  isTwilioVerifyConfigured,
  twilioVerify,
} from '@/lib/notifications'
import { renderAlreadyRegisteredEmail, renderVerificationEmail } from '@/lib/emails/verification'
import { renderPhoneOtpSms } from '@/lib/emails/phone-otp'
import { renderPasswordChangedEmail, renderPasswordResetEmail } from '@/lib/emails/password-reset'
import { env } from '@/lib/env'
import { userLocale } from '@/i18n/server'
import {
  MAX_CODE_ATTEMPTS,
  emailCodeExpiry,
  generateCode,
  hashCode,
  phoneCodeExpiry,
} from './codes'
import {
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
  tokensMatch,
} from './tokens'
import { randomBytes } from 'node:crypto'

/**
 * Compared against when no user matched, so the "unknown email" path costs
 * the same ~250ms as a real bcrypt check. Without it the response time
 * reveals which emails are registered. PRD §6.6.
 */
const DUMMY_HASH = bcrypt.hashSync('invalid-password-placeholder', AUTH.BCRYPT_COST)

export type LoginFailure = 'INVALID_CREDENTIALS' | 'EMAIL_NOT_VERIFIED' | 'ACCOUNT_SUSPENDED'

export type PasswordCheck =
  { throttled: true; retryAfterSeconds: number } | { throttled: false; user: User | null }

const loginKey = (email: string) => `login-account:${email.toLowerCase().trim()}`

/**
 * The email and password check shared by the mobile login and the web
 * sign-in, with the per-address limit on failures (#188).
 *
 * The attempt is counted before the password is compared, so a burst of
 * concurrent guesses cannot all pass the check before any is recorded, and
 * while throttled even the right password is refused. Any address is counted,
 * registered or not, so the 429 tells nobody which addresses have an account.
 * Only an attempt that opens a session is given back (loginSucceeded), so
 * frequent sign-ins are never throttled, and a right password on an
 * unverified or suspended account counts like a wrong one. `user` is null for
 * a wrong password or unknown address.
 */
export async function checkPassword(email: string, password: string): Promise<PasswordCheck> {
  const limit = checkRateLimit(loginKey(email), ACCOUNT_LOGIN_RATE_LIMIT)
  if (!limit.allowed) return { throttled: true, retryAfterSeconds: limit.retryAfterSeconds }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  // Always run a comparison so the response time does not reveal whether
  // the email exists.
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  return { throttled: false, user: user && passwordMatches ? user : null }
}

/** Gives back the attempt checkPassword counted, once it has opened a session. */
export function loginSucceeded(email: string): void {
  refundRateLimit(loginKey(email))
}

export interface LoginSuccess {
  user: Pick<User, 'id' | 'name' | 'email' | 'role'>
  accessToken: string
  refreshToken: string
}

/**
 * Thrown when a recipient has been sent too many messages.
 *
 * Enforced inside the send functions rather than only at the routes, so
 * every path — registration, resend, and anything added later — is covered
 * without each having to remember.
 */
export class RecipientThrottledError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many messages to this recipient')
    this.name = 'RecipientThrottledError'
  }
}

/** The account's language for what we send it. */
async function localeOf(where: { id: string } | { email: string }) {
  return userLocale((await prisma.user.findUnique({ where, select: { locale: true } })) ?? {})
}

export async function sendEmailVerification(userId: string, email: string): Promise<void> {
  const quota = checkRateLimit(`email-to:${email.toLowerCase()}`, EMAIL_PER_ADDRESS_RATE_LIMIT)
  if (!quota.allowed) throw new RecipientThrottledError(quota.retryAfterSeconds)

  const code = generateCode()

  // Supersede any outstanding codes: two live codes doubles the guessing
  // surface for no benefit.
  await prisma.verificationCode.updateMany({
    where: { userId, channel: 'EMAIL', usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.verificationCode.create({
    data: {
      userId,
      channel: 'EMAIL',
      codeHash: hashCode(code),
      expiresAt: emailCodeExpiry(),
    },
  })

  const message = renderVerificationEmail(
    code,
    AUTH.EMAIL_VERIFICATION_EXPIRY_MINUTES,
    await localeOf({ id: userId })
  )
  await getEmailProvider().send({ to: email, ...message })
}

/**
 * Re-sends the code when the right password is used on an unverified account,
 * for the mobile login and the web sign-in alike (#211). Neither a used-up
 * quota nor a failing provider may change the answer, or it would reveal that
 * the address has an account: a throttle is skipped quietly, anything else is
 * logged.
 */
export async function resendCodeQuietly(userId: string, email: string): Promise<void> {
  await sendEmailVerification(userId, email).catch((caught: unknown) => {
    if (!(caught instanceof RecipientThrottledError)) {
      console.error('[auth] Could not re-send a verification code:', caught)
    }
  })
}

/**
 * Sent when someone tries to register with an address that already has an
 * account. The registration endpoint returns the same 201 as a real signup,
 * so this message is the only place the fact surfaces — and it goes to the
 * address itself, which only the real owner reads.
 */
async function sendAlreadyRegisteredNotice(email: string): Promise<void> {
  const message = renderAlreadyRegisteredEmail(await localeOf({ email }))
  await getEmailProvider().send({ to: email, ...message })
}

export async function sendPhoneOtp(userId: string, phone: string): Promise<void> {
  // Keyed on the recipient, not the caller: every SMS is billed, so an
  // attacker rotating IPs must not be able to text one number repeatedly.
  const quota = checkRateLimit(`sms-to:${phone}`, SMS_PER_PHONE_RATE_LIMIT)
  if (!quota.allowed) throw new RecipientThrottledError(quota.retryAfterSeconds)

  // Twilio Verify makes, sends and checks the code itself (see twilio-provider).
  if (isTwilioVerifyConfigured()) {
    await twilioVerify.start(phone)
    return
  }

  const code = generateCode()

  await prisma.verificationCode.updateMany({
    where: { userId, channel: 'PHONE', usedAt: null },
    data: { usedAt: new Date() },
  })

  await prisma.verificationCode.create({
    data: {
      userId,
      channel: 'PHONE',
      codeHash: hashCode(code),
      expiresAt: phoneCodeExpiry(),
    },
  })
  await getSmsProvider().send({
    to: phone,
    body: renderPhoneOtpSms(code, AUTH.PHONE_OTP_EXPIRY_MINUTES, await localeOf({ id: userId })),
  })
}

export type RegisterResult =
  { outcome: 'CREATED'; userId: string } | { outcome: 'EMAIL_TAKEN' } | { outcome: 'PHONE_TAKEN' }

/**
 * Creates a player account.
 *
 * An already-registered email is **not** reported to the caller: the route
 * answers 201 either way and the real owner is told by email. Returning a
 * distinct 409 would let anyone test an address for membership, which is the
 * same leak PRD §6.6 closes on the login path.
 *
 * Phone is different. It is not a public identifier in the same way, and
 * silently accepting a duplicate would break OTP delivery, so that case is
 * reported.
 */
export async function registerPlayer(input: RegisterPlayerInput): Promise<RegisterResult> {
  return registerAccount({ ...input, role: 'PLAYER' })
}

/**
 * Creates a manager account. PRD §6.2 asks only for name, email, phone and
 * password here — company details and date of birth come later in the
 * onboarding wizard (E09).
 */
export async function registerManager(input: RegisterManagerInput): Promise<RegisterResult> {
  return registerAccount({ ...input, role: 'MANAGER' })
}

type RegisterAccountInput = {
  name: string
  email: string
  phone: string
  password: string
  role: Role
  city?: string
  dateOfBirth?: string
}

async function registerAccount(input: RegisterAccountInput): Promise<RegisterResult> {
  const email = input.email.toLowerCase().trim()

  const [existingEmail, existingPhone] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    }),
    prisma.user.findUnique({
      where: { phone: input.phone },
      select: { id: true, emailVerified: true },
    }),
  ])

  if (existingEmail) {
    if (existingEmail.emailVerified) {
      await sendAlreadyRegisteredNotice(email)
      return { outcome: 'EMAIL_TAKEN' }
    }

    // The address has an account that was never confirmed, so nobody has
    // proven they own it. Letting that stand would mean anyone could squat
    // an address by registering it first, locking out the real owner
    // permanently. Replace the unverified record instead: whoever can read
    // the inbox gets the account.
    await prisma.user.delete({ where: { id: existingEmail.id } })
  }

  if (existingPhone) {
    if (existingPhone.emailVerified) return { outcome: 'PHONE_TAKEN' }
    await prisma.user.delete({ where: { id: existingPhone.id } })
  }

  const passwordHash = await bcrypt.hash(input.password, AUTH.BCRYPT_COST)

  const user = await prisma.user.create({
    data: {
      email,
      phone: input.phone,
      passwordHash,
      name: input.name.trim(),
      city: input.city ?? null,
      dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00Z`) : null,
      role: input.role,
    },
    select: { id: true },
  })

  // The email is the account's only route to being usable: login refuses an
  // unverified account. If it cannot be sent, the row must not survive as an
  // unreachable account squatting the address.
  try {
    await sendEmailVerification(user.id, email)
  } catch (caught) {
    await prisma.user.delete({ where: { id: user.id } })
    throw caught
  }

  // No text here: the phone is verified later, from the profile, when the
  // person asks for a code (sendOwnPhoneCode). A code sent at registration
  // expired unused before anyone could reach a screen to type it in.

  return { outcome: 'CREATED', userId: user.id }
}

export async function issueTokens(
  userId: string,
  role: Role,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken({ userId, role })
  const refreshToken = generateRefreshToken()

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiry(),
      userAgent: userAgent ?? null,
    },
  })

  return { accessToken, refreshToken }
}

/**
 * Verifies credentials and issues mobile tokens.
 *
 * Returns a single INVALID_CREDENTIALS for both an unknown email and a wrong
 * password, and does the same bcrypt work in both cases.
 */
export async function loginWithPassword(
  email: string,
  password: string,
  userAgent?: string
): Promise<
  LoginSuccess | { failure: LoginFailure } | { failure: 'RATE_LIMITED'; retryAfterSeconds: number }
> {
  const check = await checkPassword(email, password)
  if (check.throttled)
    return { failure: 'RATE_LIMITED', retryAfterSeconds: check.retryAfterSeconds }
  const { user } = check

  if (!user) return { failure: 'INVALID_CREDENTIALS' }
  if (user.deletedAt || user.suspendedAt) return { failure: 'ACCOUNT_SUSPENDED' }

  if (!user.emailVerified) {
    // Correct credentials for an unverified account. Returning a distinct
    // EMAIL_NOT_VERIFIED here would undo the work the register endpoint does
    // to hide whether an address exists: an attacker registers the address,
    // then logs in with the password they chose. EMAIL_NOT_VERIFIED means
    // the address was free, INVALID_CREDENTIALS means it was taken — full
    // enumeration in two requests.
    //
    // So it answers as a credential failure and re-sends the code. Someone
    // holding the real password gets a fresh code in their inbox, which is
    // the action they needed; someone probing learns nothing.
    await resendCodeQuietly(user.id, user.email)
    return { failure: 'INVALID_CREDENTIALS' }
  }

  const tokens = await issueTokens(user.id, user.role, userAgent)
  loginSucceeded(email)

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    ...tokens,
  }
}

export type RefreshFailure = 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'TOKEN_REVOKED'

/**
 * Exchanges a refresh token for a new pair, rotating the old one.
 *
 * Rotation matters: if a refresh token is stolen, both the thief and the real
 * user hold the same string. Whoever uses it second presents a token already
 * marked replaced — detectable as theft. Without rotation a stolen token
 * works silently for its full seven days.
 */
export async function rotateRefreshToken(
  presented: string,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string } | { failure: RefreshFailure }> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(presented) },
    include: { user: { select: { id: true, role: true, deletedAt: true, suspendedAt: true } } },
  })

  if (!stored) return { failure: 'INVALID_TOKEN' }

  if (stored.revokedAt) {
    // A revoked token being presented means either a stale client or a
    // stolen one. Cannot tell which, so assume the worst and end every
    // session for this user rather than leave a thief with a working family
    // of tokens.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return { failure: 'TOKEN_REVOKED' }
  }

  if (stored.expiresAt <= new Date()) return { failure: 'TOKEN_EXPIRED' }
  if (stored.user.deletedAt || stored.user.suspendedAt) return { failure: 'TOKEN_REVOKED' }

  const accessToken = await signAccessToken({
    userId: stored.user.id,
    role: stored.user.role,
  })
  const nextToken = generateRefreshToken()

  await prisma.$transaction(async tx => {
    const created = await tx.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: hashToken(nextToken),
        expiresAt: refreshTokenExpiry(),
        userAgent: userAgent ?? null,
      },
    })
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedById: created.id },
    })
  })

  return { accessToken, refreshToken: nextToken }
}

export async function revokeRefreshToken(presented: string): Promise<void> {
  // updateMany, not update: an unknown token is a no-op rather than a throw,
  // so logout cannot be used to probe which tokens exist.
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(presented), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export type VerifyEmailFailure = 'INVALID_CODE' | 'CODE_EXPIRED' | 'TOO_MANY_ATTEMPTS'

export interface VerifyFailureDetail {
  failure: VerifyEmailFailure
  /**
   * Guesses left before the code is burned. Only meaningful for
   * INVALID_CODE, and only when a code actually exists — it is omitted
   * where reporting it would confirm an address is registered.
   */
  attemptsRemaining?: number
}

/** Confirms an email address against a code sent earlier. */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ verified: true } | { failure: VerifyEmailFailure }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  })

  // An unknown address returns the same INVALID_CODE as a wrong code, so
  // this endpoint cannot be used to test addresses either.
  if (!user) return { failure: 'INVALID_CODE' }

  // Scoped to the EMAIL channel: a code texted to the user's phone must not
  // verify their email address.
  const record = await prisma.verificationCode.findFirst({
    where: { userId: user.id, channel: 'EMAIL', usedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) return { failure: 'INVALID_CODE' }

  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    return { failure: 'TOO_MANY_ATTEMPTS' }
  }

  if (record.expiresAt <= new Date()) return { failure: 'CODE_EXPIRED' }

  if (!tokensMatch(hashCode(code), record.codeHash)) {
    // Count the failure so a six-digit code cannot be walked through.
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })
    return { failure: 'INVALID_CODE' }
  }

  await prisma.$transaction([
    prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    }),
  ])

  return { verified: true }
}

/**
 * Re-sends an email verification code.
 *
 * Returns nothing in all cases — unknown address, already verified, or sent.
 * The caller answers identically either way, so this cannot be used to test
 * whether an address is registered.
 */
export async function resendEmailVerification(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, emailVerified: true, deletedAt: true },
  })

  if (!user || user.emailVerified || user.deletedAt) return
  await sendEmailVerification(user.id, user.email)
}

/** Re-sends a phone OTP. Same silent-on-every-path contract as above. */
export async function resendPhoneOtp(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, phone: true, phoneVerified: true, deletedAt: true },
  })

  if (!user || user.phoneVerified || user.deletedAt) return
  await sendPhoneOtp(user.id, user.phone)
}

/**
 * Confirms a phone number against an OTP.
 *
 * Scoped to the PHONE channel, so an emailed code cannot confirm a phone
 * number any more than the reverse.
 */
export async function verifyPhoneCode(
  email: string,
  code: string
): Promise<{ verified: true } | VerifyFailureDetail> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  })

  // No attemptsRemaining here: reporting a count for an address with no
  // account would confirm which addresses are registered.
  if (!user) return { failure: 'INVALID_CODE' }
  return verifyPhoneCodeFor(user.id, code)
}

/**
 * Texts a code to the signed-in person's own number (#163). ALREADY_VERIFIED
 * when there is nothing to do; RecipientThrottledError when the number has
 * had its quota of texts.
 */
export async function sendOwnPhoneCode(userId: string): Promise<'SENT' | 'ALREADY_VERIFIED'> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { phone: true, phoneVerified: true },
  })
  if (user.phoneVerified) return 'ALREADY_VERIFIED'
  await sendPhoneOtp(userId, user.phone)
  return 'SENT'
}

/** The signed-in form of verifyPhoneCode: the account is known, so counts are safe to give. */
export async function verifyPhoneCodeFor(
  userId: string,
  code: string
): Promise<{ verified: true } | VerifyFailureDetail> {
  if (isTwilioVerifyConfigured()) return verifyWithTwilio(userId, code)

  const record = await prisma.verificationCode.findFirst({
    where: { userId, channel: 'PHONE', usedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) return { failure: 'INVALID_CODE' }
  if (record.attempts >= MAX_CODE_ATTEMPTS) return { failure: 'TOO_MANY_ATTEMPTS' }
  if (record.expiresAt <= new Date()) return { failure: 'CODE_EXPIRED' }

  if (!tokensMatch(hashCode(code), record.codeHash)) {
    const updated = await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    })
    const remaining = Math.max(0, MAX_CODE_ATTEMPTS - updated.attempts)
    return remaining === 0
      ? { failure: 'TOO_MANY_ATTEMPTS', attemptsRemaining: 0 }
      : { failure: 'INVALID_CODE', attemptsRemaining: remaining }
  }

  await prisma.$transaction([
    prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    }),
  ])

  return { verified: true }
}

/** verifyPhoneCodeFor when Twilio holds the code. Twilio counts the attempts, so no count is given. */
async function verifyWithTwilio(
  userId: string,
  code: string
): Promise<{ verified: true } | VerifyFailureDetail> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { phone: true },
  })
  switch (await twilioVerify.check(user.phone, code)) {
    case 'APPROVED':
      await prisma.user.update({ where: { id: userId }, data: { phoneVerified: true } })
      return { verified: true }
    case 'EXPIRED':
      return { failure: 'CODE_EXPIRED' }
    case 'TOO_MANY_ATTEMPTS':
      return { failure: 'TOO_MANY_ATTEMPTS' }
    default:
      return { failure: 'INVALID_CODE' }
  }
}

// ─── Password reset ──────────────────────────────────────────────────────────

/**
 * Starts a password reset.
 *
 * Returns nothing in every case — unknown address, suspended account, or
 * sent — so the caller answers identically and cannot be used to discover
 * which addresses are registered. PRD §6.3.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalised = email.toLowerCase().trim()

  // Keyed on the recipient, so an attacker rotating IPs still cannot flood
  // one person's inbox with reset mail.
  const quota = checkRateLimit(`reset-to:${normalised}`, PASSWORD_RESET_RATE_LIMIT)
  if (!quota.allowed) throw new RecipientThrottledError(quota.retryAfterSeconds)

  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, email: true, deletedAt: true, locale: true },
  })

  if (!user || user.deletedAt) return

  // Invalidate outstanding tokens. Several live reset links widen the window
  // in which an old email, perhaps forwarded or sitting in a shared inbox,
  // still works.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  // 256 bits from the CSPRNG. This value alone grants account access, so it
  // has to be unguessable; the database stores only its hash.
  const rawToken = randomBytes(32).toString('hex')

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + AUTH.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000),
    },
  })

  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`
  const message = renderPasswordResetEmail(
    resetUrl,
    AUTH.PASSWORD_RESET_EXPIRY_MINUTES,
    userLocale(user)
  )
  await getEmailProvider().send({ to: user.email, ...message })
}

export type ResetPasswordFailure = 'INVALID_TOKEN' | 'TOKEN_EXPIRED'

/**
 * Completes a password reset.
 *
 * On success every refresh token for the user is revoked. Someone resetting
 * a password has often lost control of the account, and leaving old mobile
 * sessions alive would let an intruder keep their access.
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string
): Promise<{ reset: true } | { failure: ResetPasswordFailure }> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: { select: { id: true, email: true, deletedAt: true, locale: true } } },
  })

  // A used or unknown token are the same answer: neither tells the caller
  // whether the token ever existed.
  if (!record || record.usedAt) return { failure: 'INVALID_TOKEN' }
  if (record.expiresAt <= new Date()) return { failure: 'TOKEN_EXPIRED' }
  if (record.user.deletedAt) return { failure: 'INVALID_TOKEN' }

  const passwordHash = await bcrypt.hash(newPassword, AUTH.BCRYPT_COST)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      // passwordChangedAt ends web sessions started before now (see the jwt
      // callback in src/auth.ts); the refresh-token revocation below does
      // the same for mobile.
      data: { passwordHash, passwordChangedAt: new Date() },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Revoked rather than deleted, so the rows remain as evidence if the
    // account is later disputed.
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  // Best-effort: the reset has already succeeded, so a mail failure must not
  // undo it. This is how a victim learns their password was changed.
  try {
    const notice = renderPasswordChangedEmail(userLocale(record.user))
    await getEmailProvider().send({ to: record.user.email, ...notice })
  } catch (caught) {
    console.error('[auth] Could not send the password-changed notice:', caught)
  }

  return { reset: true }
}
