/** GET /api/v1/admin/companies — venues waiting for approval (E09; E15 grows it). Admins only. */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { listPendingCompanies } from '@/lib/admin/companies'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireRole('ADMIN')(async () => ok(await listPendingCompanies()))
)
