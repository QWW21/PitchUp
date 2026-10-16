/**
 * PUT /api/v1/admin/disputes/:bookingId/resolve — E12-04. The player was
 * right (+10 trust, the game counts as played, a kept "deposit back" deposit
 * is refunded) or the venue was (the no-show stands). 409 once decided.
 */
import type { NextRequest } from 'next/server'
import { ResolveDisputeSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { resolveDispute } from '@/lib/admin/disputes'

export const dynamic = 'force-dynamic'

export const PUT = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) => {
    const { bookingId } = await params
    return requireRole('ADMIN')(async (req, session) => {
      const body = await validateBody(req, ResolveDisputeSchema)
      if (body.error) return body.error
      return ok(await resolveDispute(session.user.id, bookingId, body.data))
    })(request)
  }
)
