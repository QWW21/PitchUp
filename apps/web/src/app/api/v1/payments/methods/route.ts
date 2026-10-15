/**
 * GET /api/v1/payments/methods — E05-09. The player's saved cards. Empty
 * without a Stripe customer, and always empty in test mode.
 */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { prisma } from '@/lib/prisma'
import { isStripeConfigured, listCards } from '@/lib/payments/stripe'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (_request, session) => {
    if (!isStripeConfigured()) return ok([])
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })
    if (!user?.stripeCustomerId) return ok([])
    return ok(await listCards(user.stripeCustomerId))
  })
)
