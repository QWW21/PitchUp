/**
 * The shape every pitch-management route shares (E10): a signed-in venue
 * manager, their company (approved or awaiting approval), and the route's
 * params. Errors thrown inside become the standard error responses.
 */
import 'server-only'
import type { NextRequest, NextResponse } from 'next/server'
import type { Company } from '@prisma/client'
import { withErrorHandling } from '@/lib/api/response'
import { requireManager } from '@/lib/onboarding/guard'
import { pitchCompany } from './pitches'

type Handler = (
  request: NextRequest,
  company: Company,
  params: Record<string, string>
) => Promise<NextResponse>

export const pitchRoute = (handler: Handler) =>
  withErrorHandling(
    async (request: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
      const params = await ctx.params
      return requireManager(async (req, session) =>
        handler(req, await pitchCompany(session.user.id), params)
      )(request)
    }
  )
