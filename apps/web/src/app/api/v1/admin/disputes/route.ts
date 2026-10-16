/** GET /api/v1/admin/disputes — E12-04. Open no-show disputes, oldest first. Admins only. */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { listOpenDisputes } from '@/lib/admin/disputes'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  requireRole('ADMIN')(async () => {
    const response = ok(await listOpenDisputes())
    response.headers.set('Cache-Control', 'no-store')
    return response
  })
)
