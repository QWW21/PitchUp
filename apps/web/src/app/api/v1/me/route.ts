import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'

export const dynamic = 'force-dynamic'

/** Example of the requireAuth pattern, and what the mobile client calls on launch. */
export const GET = withErrorHandling(
  requireAuth(async (_request, session) =>
    ok({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    })
  )
)
