/** GET /api/v1/admin/venue-changes — approved venues whose new details wait (C-13). Admins only. */
import { ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { listVenueChanges } from '@/lib/manager/venue'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(requireRole('ADMIN')(async () => ok(await listVenueChanges())))
