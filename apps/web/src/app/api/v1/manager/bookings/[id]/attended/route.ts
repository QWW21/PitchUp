/**
 * POST /api/v1/manager/bookings/:id/attended — C-8. The player came and paid
 * at the venue; a "deposit back" booking's deposit is refunded.
 */
import type { NextRequest } from 'next/server'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireManager } from '@/lib/onboarding/guard'
import { activeCompany, confirmAttended } from '@/lib/manager/bookings'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    return requireManager(async (_request, session) => {
      const company = await activeCompany(session.user.id)
      return ok(await confirmAttended(company.id, id))
    })(request)
  }
)
