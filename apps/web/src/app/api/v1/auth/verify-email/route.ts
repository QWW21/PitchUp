import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { AUTH } from '@pitchup/shared'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { verifyEmailCode } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

const VerifyEmailSchema = z.object({
  // Keyed on the address rather than a user id: registration does not hand
  // one out, because returning it would reveal whether the address was
  // already taken.
  email: z.string().email(),
  code: z.string().regex(new RegExp(`^\\d{${AUTH.OTP_LENGTH}}$`), 'Code must be 6 digits'),
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Per-IP limit on top of the per-code attempt counter, so one attacker
  // cannot work through many accounts in parallel.
  const rate = checkRateLimit(`verify-email:${getClientIp(request)}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many attempts', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  const parsed = await validateBody(request, VerifyEmailSchema)
  if (parsed.error) return parsed.error

  const result = await verifyEmailCode(parsed.data.email, parsed.data.code)

  if ('failure' in result) {
    const message =
      result.failure === 'CODE_EXPIRED'
        ? 'That code has expired, request a new one'
        : result.failure === 'TOO_MANY_ATTEMPTS'
          ? 'Too many incorrect attempts, request a new code'
          : 'That code is not correct'
    return err('VALIDATION_ERROR', message, 400, { reason: result.failure })
  }

  return ok({ verified: true })
})
