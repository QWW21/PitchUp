/**
 * POST /api/v1/bookings/:id/dispute — E06-04. The player says they did turn
 * up. Body { disputeText }. 200 · 400 not a no-show / window closed · 404
 * · 409 already disputed.
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { REVIEW } from '@pitchup/shared'
import { getT } from '@/i18n/server'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { disputeNoShow } from '@/lib/bookings/dispute'

export const dynamic = 'force-dynamic'

const DisputeBodySchema = z.object({
  disputeText: z.string().trim().min(1, 'Say what happened').max(REVIEW.MAX_DISPUTE_TEXT_LENGTH),
})

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, DisputeBodySchema)
    if (parsed.error) return parsed.error
    const id = request.nextUrl.pathname.split('/').at(-2) ?? ''
    await disputeNoShow(id, session.user.id, parsed.data.disputeText)
    return ok({ message: (await getT())('api.ok.disputeSent') })
  })
)
