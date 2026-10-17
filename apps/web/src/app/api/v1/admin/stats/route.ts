/** GET /api/v1/admin/stats — E15-05. The platform's figures. Admins only. */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { platformStats } from '@/lib/admin/stats'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(requireRole('ADMIN')(async () => ok(await platformStats())))
