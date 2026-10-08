import { ok, err, withErrorHandling } from '@/lib/api/response'
import { resetRateLimits } from '@/lib/api/rate-limit'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Clears rate-limit counters so a test run is not skewed by earlier calls.
 *
 * Refuses outright outside development: an endpoint that resets throttling
 * is a gift to anyone brute-forcing login.
 */
export const POST = withErrorHandling(async () => {
  if (env.NODE_ENV !== 'development') {
    return err('NOT_FOUND', 'Not found', 404)
  }
  resetRateLimits()
  return ok({ reset: true })
})
