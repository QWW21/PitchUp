import type { NextRequest } from 'next/server'
import { GoogleSignInSchema } from '@pitchup/shared'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { AUTH_RATE_LIMIT, checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { isGoogleSignInConfigured, signInWithGoogle } from '@/lib/auth/google'

export const dynamic = 'force-dynamic'

/**
 * The app's Google sign-in (E02-07). Answers like the mobile login, with a
 * `status`: SIGNED_IN carries the token pair; PROFILE_NEEDED asks the app
 * for phone, city and date of birth before a new player account is made.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!isGoogleSignInConfigured()) {
    return err('SERVICE_UNAVAILABLE', 'api.googleUnavailable', 503)
  }

  // Shares the password login's budget: both are ways in.
  const rate = checkRateLimit(`login:${getClientIp(request)}`, AUTH_RATE_LIMIT)
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'api.tooManyLogins', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  const parsed = await validateBody(request, GoogleSignInSchema)
  if (parsed.error) return parsed.error

  const result = await signInWithGoogle(parsed.data, request.headers.get('user-agent') ?? undefined)

  if ('failure' in result) {
    switch (result.failure) {
      case 'ACCOUNT_SUSPENDED':
        return err('FORBIDDEN', 'api.accountUnavailable', 403, {
          reason: 'ACCOUNT_SUSPENDED',
        })
      case 'PHONE_TAKEN':
        return err('CONFLICT', 'api.phoneRegistered', 409, {
          field: 'phone',
        })
      default:
        return err('UNAUTHORIZED', 'api.googleUnconfirmed', 401)
    }
  }

  return ok(result)
})
