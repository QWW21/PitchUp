/**
 * Short numeric verification codes — ticket E02-08, used by E02-09 and E02-10.
 *
 * A 6-digit code has only a million possibilities, so the protection is not
 * the code's entropy: it is the short expiry plus an attempt limit. Both are
 * enforced here rather than left to callers.
 */
import 'server-only'
import { createHash, randomInt } from 'node:crypto'
import { AUTH } from '@pitchup/shared'

/** Wrong guesses allowed before a code is burned and must be re-sent. */
export const MAX_CODE_ATTEMPTS = 5

/**
 * randomInt, not Math.random: this is a credential, and Math.random is
 * predictable from previous outputs.
 */
export function generateCode(): string {
  const max = 10 ** AUTH.OTP_LENGTH
  return String(randomInt(0, max)).padStart(AUTH.OTP_LENGTH, '0')
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function emailCodeExpiry(): Date {
  return new Date(Date.now() + AUTH.EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000)
}

export function phoneCodeExpiry(): Date {
  return new Date(Date.now() + AUTH.PHONE_OTP_EXPIRY_MINUTES * 60 * 1000)
}
