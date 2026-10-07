import { z } from 'zod'
import { REVIEW } from '../constants/review'
import { idSchema } from './common'

export const CreateReviewSchema = z.object({
  bookingId: idSchema,
  rating: z.number().int().min(REVIEW.MIN_RATING).max(REVIEW.MAX_RATING),
  /** Optional: PRD §15 allows a rating with no text. */
  text: z.string().trim().max(REVIEW.MAX_TEXT_LENGTH).optional(),
  photoUrls: z.array(z.string().url()).max(REVIEW.MAX_PHOTOS).optional(),
  isAnonymous: z.boolean().default(false),
})

export const UpdateReviewSchema = z
  .object({
    rating: z.number().int().min(REVIEW.MIN_RATING).max(REVIEW.MAX_RATING),
    text: z.string().trim().max(REVIEW.MAX_TEXT_LENGTH),
    photoUrls: z.array(z.string().url()).max(REVIEW.MAX_PHOTOS),
    isAnonymous: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const ManagerReplySchema = z.object({
  reply: z.string().trim().min(1).max(REVIEW.MAX_MANAGER_REPLY_LENGTH),
})

/** Player-submitted report. PRD §11.3. */
export const ReportReviewSchema = z.object({
  category: z.enum(['SPAM', 'OFFENSIVE', 'IRRELEVANT', 'FAKE']),
  detail: z.string().max(300).optional(),
})

export const ModerateReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REMOVE']),
  reason: z.string().max(300).optional(),
})

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>
export type ManagerReplyInput = z.infer<typeof ManagerReplySchema>
export type ReportReviewInput = z.infer<typeof ReportReviewSchema>
export type ModerateReviewInput = z.infer<typeof ModerateReviewSchema>
