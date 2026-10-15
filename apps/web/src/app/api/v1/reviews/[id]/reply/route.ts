/**
 * The venue's reply to a review — E07-03. Managers only, and only on their
 * own company's reviews (anyone else gets 404).
 *
 * POST   { reply } → 201 · 409 ALREADY_REPLIED
 * PUT    { reply } → 200 · 400 EDIT_WINDOW_CLOSED after 24 hours
 * DELETE          → 204
 */
import { NextResponse, type NextRequest } from 'next/server'
import { ManagerReplySchema } from '@pitchup/shared'
import { created, ok, withErrorHandling } from '@/lib/api/response'
import { requireRole } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { createReply, deleteReply, updateReply } from '@/lib/reviews/reply'

export const dynamic = 'force-dynamic'

// /api/v1/reviews/:id/reply
const idOf = (request: NextRequest) => request.nextUrl.pathname.split('/').at(-2) ?? ''

export const POST = withErrorHandling(
  requireRole('MANAGER')(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, ManagerReplySchema)
    if (parsed.error) return parsed.error
    await createReply(idOf(request), session.user.id, parsed.data.reply)
    return created({ replied: true })
  })
)

export const PUT = withErrorHandling(
  requireRole('MANAGER')(async (request: NextRequest, session) => {
    const parsed = await validateBody(request, ManagerReplySchema)
    if (parsed.error) return parsed.error
    await updateReply(idOf(request), session.user.id, parsed.data.reply)
    return ok({ updated: true })
  })
)

export const DELETE = withErrorHandling(
  requireRole('MANAGER')(async (request: NextRequest, session) => {
    await deleteReply(idOf(request), session.user.id)
    return new NextResponse(null, { status: 204 })
  })
)
