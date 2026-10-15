/**
 * POST /api/v1/payments/setup-intent — E05-09. Lets the app save a card
 * without charging it. Stripe only.
 */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { ApiException } from '@/lib/api/errors'
import { createSetupIntent, getOrCreateCustomer, isStripeConfigured } from '@/lib/payments/stripe'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireAuth(async (_request, session) => {
    if (!isStripeConfigured()) {
      throw new ApiException(
        'SERVICE_UNAVAILABLE',
        'Saving cards needs Stripe, which is not set up'
      )
    }
    const customerId = await getOrCreateCustomer(session.user.id)
    return ok({ clientSecret: await createSetupIntent(customerId) })
  })
)
