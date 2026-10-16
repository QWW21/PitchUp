/**
 * GET/PUT /api/v1/notifications/preferences — E13-07. Channels (push, email,
 * SMS) and muted kinds of notification. PUT changes only what is sent;
 * switching SMS on needs a phone number (400 PHONE_REQUIRED).
 */
import { NotificationPreferencesSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { getPreferences, updatePreferences } from '@/lib/notifications/preferences'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireAuth(async (_request, session) => ok(await getPreferences(session.user.id)))
)

export const PUT = withErrorHandling(
  requireAuth(async (request, session) => {
    const body = await validateBody(request, NotificationPreferencesSchema)
    if (body.error) return body.error
    return ok(await updatePreferences(session.user.id, body.data))
  })
)
