import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { resendEmailVerification, resendPhoneOtp } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

const ResendSchema = z.object({
  email: z.string().email(),
  channel: z.enum(['EMAIL', 'PHONE']),
})

/**
 * Re-sends a verification code. Without this a code that expires leaves the
 * account permanently unreachable, since login refuses an unverified
 * account and nothing else issues a new code.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const parsed = await validateBody(request, ResendSchema)
  if (parsed.error) return parsed.error

  // Tighter than login: each call sends a real email or SMS, so an
  // unthrottled endpoint is both a spam cannon aimed at a third party and,
  // for SMS, a direct bill.
  const rate = checkRateLimit(`resend:${getClientIp(request)}`, {
    limit: 3,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many requests, try again shortly', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  if (parsed.data.channel === 'EMAIL') {
    await resendEmailVerification(parsed.data.email)
  } else {
    await resendPhoneOtp(parsed.data.email)
  }

  // Same answer whether or not the address exists, and whether or not it was
  // already verified.
  return ok({ message: 'If that account needs verifying, a new code is on its way.' })
})
