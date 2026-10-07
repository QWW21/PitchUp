import type { NextRequest } from 'next/server'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { checkRateLimit, getClientIp, GENERAL_RATE_LIMIT } from '@/lib/api/rate-limit'

/** Health checks must not be served from a build-time snapshot. */
export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (request: NextRequest) => {
  const rate = checkRateLimit(`health:${getClientIp(request)}`, GENERAL_RATE_LIMIT)
  if (!rate.allowed) {
    return err('RATE_LIMITED', 'Too many requests', 429, {
      retryAfterSeconds: rate.retryAfterSeconds,
    })
  }

  return ok({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})
