import type { NextRequest } from 'next/server'
import { RegisterPlayerSchema } from '@pitchup/shared'
import { created, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { registerPlayer } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

/** Ticket's limit: 3 registration attempts per IP per hour. */
const REGISTER_RATE_LIMIT = { limit: 3, windowMs: 60 * 60 * 1000 }

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Validate first, then spend from the budget. Counting malformed requests
  // would let anyone lock registration for a whole NAT'd office or campus
  // by posting junk three times.
  const parsed = await validateBody(request, RegisterPlayerSchema)
  if (parsed.error) return parsed.error

  const rate = checkRateLimit(`register:${getClientIp(request)}`, REGISTER_RATE_LIMIT)
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many registration attempts', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  const result = await registerPlayer(parsed.data)

  if (result.outcome === 'PHONE_TAKEN') {
    return err('CONFLICT', 'That phone number is already registered', 409, {
      field: 'phone',
    })
  }

  // EMAIL_TAKEN deliberately answers exactly as CREATED does. Returning a
  // 409 here would let anyone test whether an address has an account — the
  // leak PRD §6.6 closes on the login path. The real owner is told by email
  // instead; see sendAlreadyRegisteredNotice.
  // Byte-identical for CREATED and EMAIL_TAKEN. An earlier version returned
  // userId (null when the address was taken), which leaked exactly the fact
  // this endpoint is trying not to leak. The client verifies with the email
  // address it already knows, so it never needed the id.
  return created({ message: 'Check your email for a verification code.' })
})
