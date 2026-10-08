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
import { AUTH, type RegisterPlayerInput } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { getEmailProvider, getSmsProvider } from '@/lib/notifications'
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

/**
 * Compared against when no user matched, so the "unknown email" path costs
 * the same ~250ms as a real bcrypt check. Without it the response time
 * reveals which emails are registered. PRD §6.6.
 */
const DUMMY_HASH = bcrypt.hashSync('invalid-password-placeholder', AUTH.BCRYPT_COST)

export type LoginFailure = 'INVALID_CREDENTIALS' | 'EMAIL_NOT_VERIFIED' | 'ACCOUNT_SUSPENDED'

export interface LoginSuccess {
  user: Pick<User, 'id' | 'name' | 'email' | 'role'>
  accessToken: string
  refreshToken: string
}

export async function sendEmailVerification(userId: string, email: string): Promise<void> {
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

  await getEmailProvider().send({
    to: email,
    subject: 'Confirm your PitchUp email',
    body:
      `Your verification code is ${code}\n\n` +
      `It expires in ${AUTH.EMAIL_VERIFICATION_EXPIRY_MINUTES} minutes.\n` +
      `If you did not sign up for PitchUp, ignore this message.`,
  })
}

/**
 * Sent when someone tries to register with an address that already has an
 * account. The registration endpoint returns the same 201 as a real signup,
 * so this message is the only place the fact surfaces — and it goes to the
 * address itself, which only the real owner reads.
 */
async function sendAlreadyRegisteredNotice(email: string): Promise<void> {
  await getEmailProvider().send({
    to: email,
    subject: 'You already have a PitchUp account',
    body:
      `Someone just tried to create a PitchUp account with this email address.\n\n` +
      `You already have one, so nothing has changed. If it was you, sign in\n` +
      `instead — or use "Forgot password" if you cannot get in.\n\n` +
      `If this was not you, you can safely ignore this message.`,
  })
}

export async function sendPhoneOtp(userId: string, phone: string): Promise<void> {
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
    body: `${code} is your PitchUp verification code. It expires in ${AUTH.PHONE_OTP_EXPIRY_MINUTES} minutes.`,
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
      city: input.city,
      dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
      role: 'PLAYER',
    },
    select: { id: true },
  })

  await sendEmailVerification(user.id, email)
  await sendPhoneOtp(user.id, input.phone)

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
): Promise<LoginSuccess | { failure: LoginFailure }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  })

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)

  if (!user || !passwordMatches) return { failure: 'INVALID_CREDENTIALS' }
  if (user.deletedAt) return { failure: 'ACCOUNT_SUSPENDED' }

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
    await sendEmailVerification(user.id, user.email)
    return { failure: 'INVALID_CREDENTIALS' }
  }

  const tokens = await issueTokens(user.id, user.role, userAgent)

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
    include: { user: { select: { id: true, role: true, deletedAt: true } } },
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
  if (stored.user.deletedAt) return { failure: 'TOKEN_REVOKED' }

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

export type VerifyPhoneFailure = VerifyEmailFailure

/**
 * Confirms a phone number against an OTP.
 *
 * Scoped to the PHONE channel, so an emailed code cannot confirm a phone
 * number any more than the reverse.
 */
export async function verifyPhoneCode(
  email: string,
  code: string
): Promise<{ verified: true } | { failure: VerifyPhoneFailure }> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true },
  })

  if (!user) return { failure: 'INVALID_CODE' }

  const record = await prisma.verificationCode.findFirst({
    where: { userId: user.id, channel: 'PHONE', usedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) return { failure: 'INVALID_CODE' }
  if (record.attempts >= MAX_CODE_ATTEMPTS) return { failure: 'TOO_MANY_ATTEMPTS' }
  if (record.expiresAt <= new Date()) return { failure: 'CODE_EXPIRED' }

  if (!tokensMatch(hashCode(code), record.codeHash)) {
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
      data: { phoneVerified: true },
    }),
  ])

  return { verified: true }
}
