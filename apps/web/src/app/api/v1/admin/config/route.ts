/**
 * GET/PUT /api/v1/admin/config — E15-05. The commission on new bookings
 * (0–20%) and maintenance mode with its message. Admins only.
 */
import type { NextRequest } from 'next/server'
import { PlatformConfigSchema } from '@pitchup/shared'
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { platformConfig, updatePlatformConfig } from '@/lib/admin/config'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(requireRole('ADMIN')(async () => ok(await platformConfig())))

export const PUT = withErrorHandling(
  requireRole('ADMIN')(async (request: NextRequest, session) => {
    const body = await validateBody(request, PlatformConfigSchema)
    if (body.error) return body.error
    return ok(await updatePlatformConfig(session.user.id, body.data))
  })
)
