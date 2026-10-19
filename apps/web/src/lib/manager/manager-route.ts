/**
 * A route for a signed-in manager of an approved venue (E11): the handler
 * gets the company and the route's params. 403 NOT_ACTIVE before approval.
 */
import 'server-only'
import type { NextRequest, NextResponse } from 'next/server'
import type { Company } from '@prisma/client'
import { withErrorHandling } from '@/lib/api/response'
import { requireManager } from '@/lib/onboarding/guard'
import { activeCompany } from './bookings'

type Handler = (
  request: NextRequest,
  company: Company,
  params: Record<string, string>,
  managerId: string
) => Promise<NextResponse>

export const managerRoute = (handler: Handler) =>
  withErrorHandling(
    async (request: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
      const params = (await ctx?.params) ?? {}
      return requireManager(async (req, session) =>
        handler(req, await activeCompany(session.user.id), params, session.user.id)
      )(request)
    }
  )
