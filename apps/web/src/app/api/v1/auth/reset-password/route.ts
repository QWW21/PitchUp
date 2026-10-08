import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { passwordSchema } from '@pitchup/shared'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { resetPassword } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

const ResetPasswordSchema = z.object({
  /** 64 hex characters: randomBytes(32) rendered as hex. */
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid reset token'),
  password: passwordSchema,
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const parsed = await validateBody(request, ResetPasswordSchema)
  if (parsed.error) return parsed.error

  // A token is 256 bits and cannot realistically be guessed, but a limit
  // keeps anyone from using this endpoint as a free hashing oracle.
  const rate = checkRateLimit(`reset-password:${getClientIp(request)}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many attempts, try again shortly', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password)

  if ('failure' in result) {
    const message =
      result.failure === 'TOKEN_EXPIRED'
        ? 'That reset link has expired, request a new one'
        : 'That reset link is not valid'
    return err('VALIDATION_ERROR', message, 400, { reason: result.failure })
  }

  return ok({ message: 'Your password has been changed. Please sign in again.' })
})
