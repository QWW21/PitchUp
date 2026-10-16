/**
 * POST /api/v1/onboarding/stripe-connect — E09-04. Creates the venue's
 * Stripe Express account (once) and returns the link to Stripe's onboarding.
 * Without Stripe keys, returns our own return URL (a test account).
 * → { url } · 400 STEPS_INCOMPLETE · 503 when Stripe is unreachable
 */
import { ok, withErrorHandling } from '@/lib/api/response'
import { startConnect } from '@/lib/onboarding/connect'
import { requireManager } from '@/lib/onboarding/guard'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireManager(async (_request, session) =>
    ok(await startConnect({ id: session.user.id, email: session.user.email ?? '' }))
  )
)
