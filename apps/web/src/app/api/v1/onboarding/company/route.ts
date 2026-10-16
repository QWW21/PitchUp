/**
 * Onboarding step 1, company info — E09-01. Venue managers only.
 *
 * POST { name, description?, logoUrl?, websiteUrl?, facebookUrl?, instagramUrl? }
 *      → 201 { id, created: true } · 409 COMPANY_EXISTS (one company per manager)
 * PUT  same body → 200 { id, created: false }, while the company is DRAFT or PENDING
 */
import type { NextRequest } from 'next/server'
import { CompanyInfoSchema } from '@pitchup/shared'
import { created, err, ok, withErrorHandling } from '@/lib/api/response'
import { validateBody } from '@/lib/api/validate'
import { managerCompany, saveInfo } from '@/lib/onboarding/company'
import { requireManager } from '@/lib/onboarding/guard'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(
  requireManager(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, CompanyInfoSchema)
    if (parsed.error) return parsed.error
    if (await managerCompany(session.user.id)) {
      return err('CONFLICT', 'You already have a company', 409, { reason: 'COMPANY_EXISTS' })
    }
    return created(await saveInfo(session.user.id, parsed.data))
  })
)

export const PUT = withErrorHandling(
  requireManager(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, CompanyInfoSchema)
    if (parsed.error) return parsed.error
    if (!(await managerCompany(session.user.id))) {
      return err('NOT_FOUND', 'Start with your company details', 404, { reason: 'NO_COMPANY' })
    }
    return ok(await saveInfo(session.user.id, parsed.data))
  })
)
