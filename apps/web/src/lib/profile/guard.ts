/**
 * Endpoints that take the account password (change it, delete the account)
 * share one limit per user: 5 tries in 15 minutes (E08-03). Without it a
 * stolen session could be used to guess the password.
 */
import 'server-only'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { err } from '@/lib/api/response'

export function passwordAttemptLimit(userId: string) {
  const rate = checkRateLimit(`password-check:${userId}`, { limit: 5, windowMs: 15 * 60_000 })
  return rate.allowed
    ? null
    : err('RATE_LIMITED', 'Too many attempts, try again shortly', 429, {
        retryAfterSeconds: rate.retryAfterSeconds,
      })
}
