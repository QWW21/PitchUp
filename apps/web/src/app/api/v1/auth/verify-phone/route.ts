import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { AUTH } from '@pitchup/shared'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { verifyPhoneCode } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

const VerifyPhoneSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(new RegExp(`^\\d{${AUTH.OTP_LENGTH}}$`), 'Code must be 6 digits'),
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const rate = checkRateLimit(`verify-phone:${getClientIp(request)}`, {
    limit: 20,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many attempts', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  const parsed = await validateBody(request, VerifyPhoneSchema)
  if (parsed.error) return parsed.error

  const result = await verifyPhoneCode(parsed.data.email, parsed.data.code)

  if ('failure' in result) {
    // The ticket asks for distinct statuses: 410 for an expired code, 429
    // once the code is burned, 400 for a plain wrong guess.
    const detail: Record<string, unknown> = { reason: result.failure }
    if (result.attemptsRemaining !== undefined) {
      detail.attemptsRemaining = result.attemptsRemaining
    }

    switch (result.failure) {
      case 'CODE_EXPIRED':
        return err('NOT_FOUND', 'That code has expired, request a new one', 410, detail)
      case 'TOO_MANY_ATTEMPTS':
        return err('RATE_LIMITED', 'Too many incorrect attempts, request a new code', 429, detail)
      default:
        return err('VALIDATION_ERROR', 'That code is not correct', 400, detail)
    }
  }

  return ok({ verified: true })
})
