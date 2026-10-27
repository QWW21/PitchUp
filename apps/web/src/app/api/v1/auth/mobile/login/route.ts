import type { NextRequest } from 'next/server'
import { LoginSchema } from '@pitchup/shared'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { AUTH_RATE_LIMIT, checkRateLimit, loginIpKey, refundRateLimit } from '@/lib/api/rate-limit'
import { loginWithPassword } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

/**
 * Mobile login. Web signs in through NextAuth and receives a cookie; mobile
 * gets a JWT pair it stores in the device keychain (E02-12).
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Shared with the web sign-in; a successful login is given back below (#208).
  const ipKey = loginIpKey(request)
  const rate = checkRateLimit(ipKey, AUTH_RATE_LIMIT)
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'api.tooManyLogins', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  const parsed = await validateBody(request, LoginSchema)
  if (parsed.error) return parsed.error

  const result = await loginWithPassword(
    parsed.data.email,
    parsed.data.password,
    request.headers.get('user-agent') ?? undefined
  )

  if ('failure' in result) {
    switch (result.failure) {
      case 'RATE_LIMITED':
        // #188: too many failures for this address. Same answer as the IP
        // limit above, for registered and unknown addresses alike.
        return err('RATE_LIMITED', 'api.tooManyLogins', 429, {
          retryAfterSeconds: result.retryAfterSeconds,
        })
      case 'EMAIL_NOT_VERIFIED':
        return err('FORBIDDEN', 'api.verifyEmailFirst', 403, {
          reason: 'EMAIL_NOT_VERIFIED',
        })
      case 'ACCOUNT_SUSPENDED':
        return err('FORBIDDEN', 'api.accountUnavailable', 403, {
          reason: 'ACCOUNT_SUSPENDED',
        })
      default:
        // One response for both an unknown email and a wrong password.
        return err('UNAUTHORIZED', 'api.wrongLogin', 401)
    }
  }

  refundRateLimit(ipKey)
  return ok(result)
})
