/**
 * Mobile token issuing and verification — ticket E02-08.
 *
 * Web clients use the NextAuth session cookie. Mobile cannot hold cookies
 * reliably, so it gets a short-lived JWT access token plus a long-lived
 * opaque refresh token.
 *
 * Why the access token is short (15 minutes): it is a bearer credential that
 * is not checked against the database on each request, so revoking it is
 * impossible. Expiry is the only bound on a stolen one. The refresh token is
 * long-lived but *is* checked against the database, so it can be revoked.
 */
import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import type { Role } from '@prisma/client'
import { env } from '@/lib/env'

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_DAYS = 7

const ISSUER = 'pitchup'
const AUDIENCE = 'pitchup-mobile'

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.NEXTAUTH_SECRET)
}

export interface AccessTokenClaims {
  userId: string
  role: Role
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey())
}

/**
 * Returns the claims, or null for any invalid token.
 *
 * Deliberately does not distinguish expired from malformed from
 * wrong-signature: the caller gets 401 either way, and the distinction only
 * helps someone probing the endpoint.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    })
    if (!payload.sub || typeof payload.role !== 'string') return null
    return { userId: payload.sub, role: payload.role as Role }
  } catch {
    return null
  }
}

/**
 * Refresh tokens are random, not JWTs: there is nothing to read in them, and
 * the only question asked is "is this row in the database and still valid?"
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * SHA-256, not bcrypt.
 *
 * bcrypt is deliberately slow to make guessing a low-entropy human password
 * expensive. A refresh token is 256 bits of randomness — it cannot be
 * guessed, so the slowness buys nothing and would cost ~250ms on every
 * refresh. The hash is here so a leaked database does not hand over live
 * sessions.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time comparison, for cases where a hash is compared directly. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
}

/** Reads a bearer token out of an Authorization header. */
export function bearerFromHeader(header: string | null): string | null {
  if (!header) return null
  const [scheme, value] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null
  return value
}
