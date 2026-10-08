import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { rotateRefreshToken } from '@/lib/auth/service'

export const dynamic = 'force-dynamic'

const RefreshSchema = z.object({ refreshToken: z.string().min(1) })

export const POST = withErrorHandling(async (request: NextRequest) => {
  const rate = checkRateLimit(`refresh:${getClientIp(request)}`, {
    limit: 30,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many refresh attempts', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  const parsed = await validateBody(request, RefreshSchema)
  if (parsed.error) return parsed.error

  const result = await rotateRefreshToken(
    parsed.data.refreshToken,
    request.headers.get('user-agent') ?? undefined
  )

  if ('failure' in result) {
    // The client's only correct response to any of these is to sign in
    // again, so the distinction is for its UX, not an access decision.
    return err('UNAUTHORIZED', 'Session expired, please sign in again', 401, {
      reason: result.failure,
    })
  }

  return ok(result)
})
