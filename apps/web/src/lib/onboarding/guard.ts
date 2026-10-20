/**
 * Onboarding and the manager area are for venue managers only. requireRole
 * also lets admins through (they pass every check); onboarding is about the
 * caller's own company, which an admin does not have, so it asks for the
 * MANAGER role exactly.
 */
import 'server-only'
import type { NextRequest, NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { requireAuth } from '@/lib/api/middleware'
import { err } from '@/lib/api/response'

export function requireManager(
  handler: (request: NextRequest, session: Session) => Promise<NextResponse>
) {
  return requireAuth(async (request, session) => {
    if (session.user.role !== 'MANAGER') return err('FORBIDDEN', 'api.managersOnly', 403)
    return handler(request, session)
  })
}
