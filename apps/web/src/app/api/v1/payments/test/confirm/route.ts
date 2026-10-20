/**
 * POST /api/v1/payments/test/confirm — test mode only (no Stripe keys, and
 * development or ALLOW_TEST_HOOKS=1). Finishes a test payment as a success
 * or a declined card, through the same code the Stripe webhook runs.
 */
import type { NextRequest } from 'next/server'
import { TestPaymentSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { notFound } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { getPaymentProvider } from '@/lib/payments'
import { confirmPaid, markPaymentFailed } from '@/lib/bookings/payment-events'
import { getBookingForViewer } from '@/lib/bookings/read'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    if (getPaymentProvider()?.name !== 'test') throw notFound()
    const parsed = await validateBody(request, TestPaymentSchema)
    if (parsed.error) return parsed.error

    const booking = await prisma.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: { playerId: true, paymentProvider: true, stripePaymentIntentId: true },
    })
    if (
      !booking ||
      booking.playerId !== session.user.id ||
      booking.paymentProvider !== 'test' ||
      !booking.stripePaymentIntentId
    ) {
      throw notFound('api.bookingNotFound')
    }

    if (parsed.data.outcome === 'succeed') {
      await confirmPaid(parsed.data.bookingId, booking.stripePaymentIntentId)
    } else {
      await markPaymentFailed(parsed.data.bookingId, 'Your card was declined.')
    }
    return ok(
      await getBookingForViewer(parsed.data.bookingId, {
        id: session.user.id,
        role: session.user.role,
      })
    )
  })
)
