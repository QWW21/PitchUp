/**
 * GET /api/v1/companies/:id — E04-01. Public.
 * Approved companies only; pending or suspended ones are 404.
 */
import type { NextRequest } from 'next/server'
import { err, ok, withErrorHandling } from '@/lib/api/response'
import { getCompanyDetail } from '@/lib/venues/company'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const company = await getCompanyDetail(id)
    if (!company) return err('NOT_FOUND', 'Company not found', 404)
    return ok(company)
  }
)
