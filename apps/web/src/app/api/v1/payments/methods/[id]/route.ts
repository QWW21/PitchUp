/**
 * DELETE /api/v1/payments/methods/:id — E05-09. Removes one of the player's
 * own saved cards; another player's card id is a 404, never a deletion.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { notFound } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { detachCard, isStripeConfigured } from '@/lib/payments/stripe'

export const dynamic = 'force-dynamic'

export const DELETE = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const id = request.nextUrl.pathname.split('/').pop() ?? ''
    if (!isStripeConfigured()) throw notFound('api.cardNotFound')
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    })
    if (!user?.stripeCustomerId || !(await detachCard(user.stripeCustomerId, id))) {
      throw notFound('api.cardNotFound')
    }
    return new NextResponse(null, { status: 204 })
  })
)
