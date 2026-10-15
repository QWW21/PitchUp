/**
 * GET /api/v1/payments/config — public. Which payment provider is in use
 * and, for Stripe, the publishable key the app needs. `provider: null`
 * means bookings cannot be paid right now.
 */
import { ok, withErrorHandling } from '@/lib/api/response'
import { paymentConfig } from '@/lib/payments'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async () => ok(paymentConfig()))
