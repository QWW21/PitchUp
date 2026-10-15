/**
 * POST /api/v1/notifications/device-token { token, platform } — E08-10.
 * Remembers a phone that can receive push. Registering the same token again
 * (or from another account on the same phone) moves it to this user.
 */
import type { NextRequest } from 'next/server'
import { DeviceTokenSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { registerDeviceToken } from '@/lib/profile/notifications'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, DeviceTokenSchema)
    if (parsed.error) return parsed.error
    await registerDeviceToken(session.user.id, parsed.data.token, parsed.data.platform)
    return ok({ registered: true })
  })
)
