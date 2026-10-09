import type { NextRequest } from 'next/server'
import { RegisterManagerSchema } from '@pitchup/shared'
import { created, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { registerManager } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

const REGISTER_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Validated before the budget is spent, so malformed bodies cannot lock
  // registration for everyone behind one IP.
  const parsed = await validateBody(request, RegisterManagerSchema)
  if (parsed.error) return parsed.error

  const rate = checkRateLimit(`register-manager:${getClientIp(request)}`, REGISTER_RATE_LIMIT)
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many registration attempts', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  let result
  try {
    result = await registerManager(parsed.data)
  } catch (caught) {
    console.error('[auth] Manager registration failed:', caught)
    return err('INTERNAL_ERROR', 'Could not complete sign-up, please try again', 500)
  }

  if (result.outcome === 'PHONE_TAKEN') {
    return err('CONFLICT', 'That phone number is already registered', 409, { field: 'phone' })
  }

  // Identical for CREATED and EMAIL_TAKEN, as on the player route: a
  // distinct response would let anyone test whether an address has an
  // account. The real owner is told by email.
  return created({ message: 'Check your email for a verification code.' })
})
