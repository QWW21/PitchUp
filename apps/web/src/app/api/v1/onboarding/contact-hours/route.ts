/**
 * PUT /api/v1/onboarding/contact-hours — E09-03. Public phone and email,
 * and opening hours for all seven days (at least one open; a close earlier
 * than the open means after midnight).
 * → { id, phone, email }
 */
import type { NextRequest } from 'next/server'
import { ContactHoursSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { saveContactHours } from '@/lib/onboarding/company'
import { requireManager } from '@/lib/onboarding/guard'

export const dynamic = 'force-dynamic'

export const PUT = withErrorHandling(
  requireManager(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, ContactHoursSchema)
    if (parsed.error) return parsed.error
    return ok(await saveContactHours(session.user.id, parsed.data))
  })
)
