/**
 * GET /api/v1/pitches/:id/payment-options — C-8. How the signed-in player
 * may pay for this pitch: the venue's mode and deposit, filtered by their
 * trust score. Booking creation applies the same rule.
 */
import type { NextRequest } from 'next/server'
import { paymentMethodsFor, type PaymentOptions } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound, unauthorized } from '@/lib/api/errors'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    return requireAuth(async (_request, session) => {
      const [pitch, user] = await Promise.all([
        prisma.pitch.findUnique({
          where: { id },
          select: {
            company: { select: { status: true, paymentMode: true, depositPercent: true } },
          },
        }),
        prisma.user.findUnique({ where: { id: session.user.id }, select: { trustScore: true } }),
      ])
      if (!user) throw unauthorized()
      if (!pitch || pitch.company.status !== 'ACTIVE') throw notFound('Pitch not found')
      const { paymentMode: mode, depositPercent } = pitch.company
      const methods = paymentMethodsFor(mode, depositPercent, user.trustScore)
      const options: PaymentOptions = {
        mode,
        depositPercent,
        methods,
        trustTooLow: mode !== 'ONLINE' && !methods.some(m => m !== 'ONLINE'),
      }
      const response = ok(options)
      response.headers.set('Cache-Control', 'no-store')
      return response
    })(request)
  }
)
