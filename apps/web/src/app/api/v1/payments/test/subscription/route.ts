/**
 * POST /api/v1/payments/test/subscription { outcome } — test mode only (no
 * Stripe keys, and development or ALLOW_TEST_HOOKS=1). The venue's next
 * subscription bill pays or fails now, through the same code the Stripe
 * webhook runs (C-15).
 */
import { TestSubscriptionSchema } from '@pitchup/shared'
import { ok } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { notFound } from '@/lib/api/errors'
import { getPaymentProvider } from '@/lib/payments'
import { getBilling, testBillOutcome } from '@/lib/billing'
import { managerRoute } from '@/lib/manager/manager-route'

export const dynamic = 'force-dynamic'

export const POST = managerRoute(async (request, company) => {
  if (getPaymentProvider()?.name !== 'test') throw notFound()
  const body = await validateBody(request, TestSubscriptionSchema)
  if (body.error) return body.error
  await testBillOutcome(company.id, body.data.outcome)
  return ok(await getBilling(company.id))
})
