import { ok, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Example of the requireAuth pattern, and what the mobile client calls on
 * launch. `trustScore` lets the app disable Book Now for a Suspended tier
 * (E04-06); the tier itself is derived on the client with trustTier().
 */
export const GET = withErrorHandling(
  requireAuth(async (_request, session) => {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { trustScore: true },
    })
    return ok({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      trustScore: user?.trustScore ?? null,
    })
  })
)
