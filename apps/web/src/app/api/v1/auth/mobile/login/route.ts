import type { NextRequest } from 'next/server'
import { LoginSchema } from '@pitchup/shared'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { AUTH_RATE_LIMIT, checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { loginWithPassword } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

/**
 * Mobile login. Web signs in through NextAuth and receives a cookie; mobile
 * gets a JWT pair it stores in the device keychain (E02-12).
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const rate = checkRateLimit(`login:${getClientIp(request)}`, AUTH_RATE_LIMIT)
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many login attempts', 429, {
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
      case 'EMAIL_NOT_VERIFIED':
        return err('FORBIDDEN', 'Verify your email address before signing in', 403, {
          reason: 'EMAIL_NOT_VERIFIED',
        })
      case 'ACCOUNT_SUSPENDED':
        return err('FORBIDDEN', 'This account is not available', 403, {
          reason: 'ACCOUNT_SUSPENDED',
        })
      default:
        // One response for both an unknown email and a wrong password.
        return err('UNAUTHORIZED', 'Incorrect email or password', 401)
    }
  }

  return ok(result)
})
