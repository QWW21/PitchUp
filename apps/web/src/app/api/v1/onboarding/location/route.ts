/**
 * PUT /api/v1/onboarding/location — E09-02. The address, and the map pin's
 * coordinates when there are any; without them the server geocodes the
 * address (if a server key is set). A failed geocode is not an error: the
 * address is saved and `geocoded` is false.
 * → { id, lat, lng, geocoded }
 */
import type { NextRequest } from 'next/server'
import { CompanyLocationSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { saveLocation } from '@/lib/onboarding/company'
import { requireManager } from '@/lib/onboarding/guard'

export const dynamic = 'force-dynamic'

export const PUT = withErrorHandling(
  requireManager(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, CompanyLocationSchema)
    if (parsed.error) return parsed.error
    return ok(await saveLocation(session.user.id, parsed.data))
  })
)
