/**
 * Google sign-in — E02-07.
 *
 * Google proves who the person is; the account stays ours. An ID token from
 * Google is checked here (signature against Google's published keys,
 * issuer, audience, expiry, a verified address) and matched to a PitchUp
 * account by email. No second user store, no Account table: the email is
 * the link, the same key the password login uses.
 */
import 'server-only'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { AUTH, type GoogleSignInInput } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { issueTokens, type LoginSuccess } from './service'

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

/** jose caches the keys and refetches when Google rotates them. */
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

/** Whether the Web client is configured; without it every Google path is off. */
export function isGoogleSignInConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID)
}

export interface GoogleIdentity {
  email: string
  name: string
}

/**
 * The person an ID token names, or null when it is not a genuine, current
 * token for one of our clients with a verified address. The app asks Google
 * for a token addressed to the Web client; the iOS client is accepted too.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  keys: JWTVerifyGetKey = googleKeys
): Promise<GoogleIdentity | null> {
  const audience = [env.GOOGLE_CLIENT_ID, env.GOOGLE_IOS_CLIENT_ID].filter((id): id is string =>
    Boolean(id)
  )
  if (audience.length === 0) return null
  try {
    const { payload } = await jwtVerify(idToken, keys, { issuer: GOOGLE_ISSUERS, audience })
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null
    if (!email || payload.email_verified !== true) return null
    const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : ''
    return { email, name }
  } catch {
    return null
  }
}

export type GoogleSignInResult =
  | ({ status: 'SIGNED_IN' } & LoginSuccess)
  | { status: 'PROFILE_NEEDED'; email: string; name: string }
  | { failure: 'INVALID_TOKEN' | 'ACCOUNT_SUSPENDED' | 'PHONE_TAKEN' }

/**
 * The app's Google sign-in. An address with a confirmed account signs in. A
 * new address needs the details Google does not have, so the first call
 * answers PROFILE_NEEDED and the second, with `profile`, creates a player.
 */
export async function signInWithGoogle(
  input: GoogleSignInInput,
  userAgent?: string,
  keys?: JWTVerifyGetKey
): Promise<GoogleSignInResult> {
  const identity = await verifyGoogleIdToken(input.idToken, keys)
  if (!identity) return { failure: 'INVALID_TOKEN' }

  const existing = await prisma.user.findUnique({ where: { email: identity.email } })

  if (existing?.emailVerified) {
    if (existing.deletedAt || existing.suspendedAt) return { failure: 'ACCOUNT_SUSPENDED' }
    const tokens = await issueTokens(existing.id, existing.role, userAgent)
    return {
      status: 'SIGNED_IN',
      user: { id: existing.id, name: existing.name, email: existing.email, role: existing.role },
      ...tokens,
    }
  }

  if (!input.profile) {
    return { status: 'PROFILE_NEEDED', email: identity.email, name: identity.name }
  }

  // An unconfirmed account on this address or number proves nothing, so it
  // is replaced, as registration does (registerAccount).
  const phoneOwner = await prisma.user.findUnique({
    where: { phone: input.profile.phone },
    select: { id: true, emailVerified: true },
  })
  if (phoneOwner?.emailVerified) return { failure: 'PHONE_TAKEN' }
  const stale = [existing?.id, phoneOwner?.id].filter((id): id is string => Boolean(id))
  if (stale.length > 0) await prisma.user.deleteMany({ where: { id: { in: stale } } })

  // No password was chosen. A random one nobody knows keeps the column's
  // contract; "Forgot password" sets a real one if they ever want it.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), AUTH.BCRYPT_COST)
  const user = await prisma.user.create({
    data: {
      email: identity.email,
      phone: input.profile.phone,
      passwordHash,
      name: identity.name || identity.email.split('@')[0]!,
      city: input.profile.city,
      dateOfBirth: new Date(`${input.profile.dateOfBirth}T00:00:00Z`),
      role: 'PLAYER',
      // Google has confirmed the address; the phone is verified later, from
      // the profile (sendOwnPhoneCode).
      emailVerified: true,
    },
  })

  const tokens = await issueTokens(user.id, user.role, userAgent)
  return {
    status: 'SIGNED_IN',
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    ...tokens,
  }
}

/**
 * The web's Google sign-in (the manager portal) only opens accounts that
 * already exist and are confirmed: new venues register through the form.
 */
export async function accountForGoogleEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || !user.emailVerified || user.deletedAt || user.suspendedAt) return null
  return user
}
