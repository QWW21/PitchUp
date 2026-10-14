import { ok, err, withErrorHandling } from '@/lib/api/response'
import { resetRateLimits } from '@/lib/api/rate-limit'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Clears rate-limit counters so a test run is not skewed by earlier calls.
 *
 * Refuses outright outside development: an endpoint that resets throttling
 * is a gift to anyone brute-forcing login. The one exception is the E2E
 * suite, which runs a production build and opts in with ALLOW_TEST_HOOKS=1
 * on its own server (apps/web/playwright.config.ts). Never set it anywhere else.
 */
export const POST = withErrorHandling(async () => {
  if (env.NODE_ENV !== 'development' && env.ALLOW_TEST_HOOKS !== '1') {
    return err('NOT_FOUND', 'Not found', 404)
  }
  resetRateLimits()
  return ok({ reset: true })
})
