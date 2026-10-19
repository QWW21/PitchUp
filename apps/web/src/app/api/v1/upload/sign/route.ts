/**
 * Signed upload endpoint — ticket E01-10.
 *
 * Returns a short-lived signature so the client can upload straight to
 * Cloudinary. Size and MIME type are checked here, before a signature exists,
 * because once issued the upload no longer passes through this server.
 */
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, withErrorHandling } from '@/lib/api/response'
import { requireAuth } from '@/lib/api/middleware'
import { validateBody } from '@/lib/api/validate'
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit'
import { prisma } from '@/lib/prisma'
import {
  ALLOWED_MIME_TYPES,
  UPLOAD_CONTEXTS,
  buildFolder,
  createUploadSignature,
  isCloudinaryConfigured,
  type UploadContext,
} from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'

const SignRequestSchema = z.object({
  context: z.enum(['PITCH', 'COMPANY', 'USER', 'REVIEW']),
  /** The pitch, company, user or review the image belongs to. */
  ownerId: z.string().cuid(),
  contentType: z.enum(ALLOWED_MIME_TYPES),
  sizeBytes: z.number().int().positive(),
  publicId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,100}$/, 'publicId may contain letters, digits, _ and - only')
    .optional(),
})

export const POST = withErrorHandling(
  requireAuth(async (request: NextRequest, session) => {
    const rate = checkRateLimit(`upload-sign:${getClientIp(request)}`, {
      limit: 30,
      windowMs: 60_000,
    })
    if (!rate.allowed) {
      return err('RATE_LIMITED', 'Too many upload requests', 429, {
        retryAfterSeconds: rate.retryAfterSeconds,
      })
    }

    if (!isCloudinaryConfigured()) {
      return err('INTERNAL_ERROR', 'Uploads are not available', 500)
    }

    const parsed = await validateBody(request, SignRequestSchema)
    if (parsed.error) return parsed.error

    const { context, ownerId, sizeBytes, publicId } = parsed.data
    const { maxBytes } = UPLOAD_CONTEXTS[context as UploadContext]

    if (sizeBytes > maxBytes) {
      return err('VALIDATION_ERROR', 'File is too large', 400, {
        maxBytes,
        receivedBytes: sizeBytes,
      })
    }

    // A player may only upload under their own user folder.
    if (context === 'USER' && ownerId !== session.user.id) {
      return err('FORBIDDEN', 'Cannot upload to another user', 403)
    }
    // Review photos are uploaded before the review exists, under its booking
    // (E06-05): only that booking's player may.
    if (context === 'REVIEW') {
      const booking = await prisma.booking.findUnique({
        where: { id: ownerId },
        select: { playerId: true },
      })
      if (booking?.playerId !== session.user.id) {
        return err('FORBIDDEN', 'Cannot upload photos for this booking', 403)
      }
    }

    // A company's logo and photos: its own manager only. During onboarding the
    // logo comes before the company exists, so the manager's own id is
    // accepted while they have no company yet (E09-06).
    if (context === 'COMPANY') {
      const company = await prisma.company.findUnique({
        where: { ownerId: session.user.id },
        select: { id: true },
      })
      const allowed = company ? ownerId === company.id : ownerId === session.user.id
      if (session.user.role !== 'MANAGER' || !allowed) {
        return err('FORBIDDEN', 'Cannot upload for this company', 403)
      }
    }

    // Pitch photos (E10-02): the pitch's own venue manager only.
    if (context === 'PITCH') {
      const pitch = await prisma.pitch.findFirst({
        where: { id: ownerId, deletedAt: null },
        select: { company: { select: { ownerId: true } } },
      })
      if (session.user.role !== 'MANAGER' || pitch?.company.ownerId !== session.user.id) {
        return err('FORBIDDEN', 'Cannot upload photos for this pitch', 403)
      }
    }

    try {
      const folder = buildFolder(context as UploadContext, ownerId)
      return ok(createUploadSignature(folder, publicId))
    } catch (caught) {
      // Never surface Cloudinary's own error text to the client.
      console.error('Failed to create upload signature:', caught)
      return err('INTERNAL_ERROR', 'Could not prepare the upload', 500)
    }
  })
)
