import type { NextRequest } from 'next/server'
import { ForgotPasswordSchema } from '@pitchup/shared'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { RecipientThrottledError, requestPasswordReset } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

/** Identical for every outcome, so it cannot be used to test addresses. */
const ALWAYS = 'If that email is registered, a reset link is on its way.'

export const POST = withErrorHandling(async (request: NextRequest) => {
  const parsed = await validateBody(request, ForgotPasswordSchema)
  if (parsed.error) return parsed.error

  const rate = checkRateLimit(`forgot-password:${getClientIp(request)}`, {
    limit: 5,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many requests, try again shortly', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  try {
    await requestPasswordReset(parsed.data.email)
  } catch (caught) {
    if (caught instanceof RecipientThrottledError) {
      // Reported the same way as the per-IP limit. Distinguishing them would
      // reveal that the address has an account worth throttling.
      return err('RATE_LIMITED', 'Too many requests, try again shortly', 429, {
        retryAfterSeconds: caught.retryAfterSeconds,
      })
    }
    // A mail outage must not change the answer either.
    console.error('[auth] Could not start a password reset:', caught)
  }

  return ok({ message: ALWAYS })
})
