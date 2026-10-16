/**
 * POST /api/v1/manager/bookings/:id/no-show — C-8. From 30 minutes after
 * kick-off; the venue keeps what was paid online and the player loses trust.
 */
import type { NextRequest } from 'next/server'
import { ReportNoShowSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { requireManager } from '@/lib/onboarding/guard'
import { activeCompany, reportNoShow } from '@/lib/manager/bookings'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    return requireManager(async (req, session) => {
      const body = await validateBody(req, ReportNoShowSchema)
      if (body.error) return body.error
      const company = await activeCompany(session.user.id)
      return ok(await reportNoShow(company.id, session.user.id, id, body.data.reason))
    })(request)
  }
)
