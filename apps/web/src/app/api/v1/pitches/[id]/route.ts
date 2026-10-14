/**
 * GET /api/v1/pitches/:id — E04-02. Public.
 * 404 when the pitch's company is not approved. An inactive pitch is still
 * returned (direct links) with `isBookable: false`.
 */
import type { NextRequest } from 'next/server'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { getPitchDetail } from '@/lib/venues/pitch'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const pitch = await getPitchDetail(id)
    if (!pitch) return err('NOT_FOUND', 'Pitch not found', 404)
    return ok(pitch)
  }
)
