import { z } from 'zod'
import { REVIEW } from '../constants/review'
import { idSchema } from './common'

/**
 * Review text: optional, but a few words at least when given (E06-05).
 * Blank counts as none.
 */
const reviewText = z.preprocess(
  v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .min(
      REVIEW.MIN_TEXT_LENGTH,
      `Write at least ${REVIEW.MIN_TEXT_LENGTH} characters, or leave it empty`
    )
    .max(REVIEW.MAX_TEXT_LENGTH)
    .optional()
)

export const CreateReviewSchema = z.object({
  bookingId: idSchema,
  rating: z.number().int().min(REVIEW.MIN_RATING).max(REVIEW.MAX_RATING),
  /** Optional: PRD §15 allows a rating with no text. */
  text: reviewText,
  photoUrls: z.array(z.string().url()).max(REVIEW.MAX_PHOTOS).optional(),
  isAnonymous: z.boolean().default(false),
})

export const UpdateReviewSchema = z
  .object({
    rating: z.number().int().min(REVIEW.MIN_RATING).max(REVIEW.MAX_RATING),
    text: reviewText,
    photoUrls: z.array(z.string().url()).max(REVIEW.MAX_PHOTOS),
    isAnonymous: z.boolean(),
  })
  .partial()
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const ManagerReplySchema = z.object({
  reply: z.string().trim().min(1).max(REVIEW.MAX_MANAGER_REPLY_LENGTH),
})

export const REPORT_CATEGORIES = ['SPAM', 'OFFENSIVE', 'IRRELEVANT', 'FAKE'] as const
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  SPAM: 'Spam',
  OFFENSIVE: 'Offensive',
  IRRELEVANT: 'Not about this pitch',
  FAKE: 'Fake review',
}

/** A report of a review, by any signed-in user. PRD §11.3, E07-04. */
export const ReportReviewSchema = z.object({
  category: z.enum(REPORT_CATEGORIES),
  detail: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(REVIEW.MAX_REPORT_DETAIL_LENGTH).optional()
  ),
})

// ── Listing (E07) ───────────────────────────────────────────────────────────

/** Public orders, E07-01. `unanswered` puts reviews without a reply first. */
export const REVIEW_SORTS = ['newest', 'highest', 'lowest', 'unanswered'] as const
export type ReviewSort = (typeof REVIEW_SORTS)[number]
export const REVIEW_SORT_LABELS: Record<ReviewSort, string> = {
  newest: 'Newest',
  highest: 'Highest',
  lowest: 'Lowest',
  unanswered: 'Unanswered',
}

/** GET /pitches/:id/reviews and GET /reviews — page-based, like E04. */
export const ReviewListQuerySchema = z.object({
  sort: z.enum(REVIEW_SORTS).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

/** The manager's list, E07-05/09: their company's reviews. */
export const MANAGER_REVIEW_SORTS = ['newest', 'lowest', 'unanswered'] as const
export type ManagerReviewSort = (typeof MANAGER_REVIEW_SORTS)[number]
export const ManagerReviewQuerySchema = z.object({
  pitchId: z.string().min(1).optional(),
  sort: z.enum(MANAGER_REVIEW_SORTS).default('newest'),
  /** Player name; anonymous reviews never match. */
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** A manager's reply as anyone sees it. */
export interface ReviewReply {
  text: string
  createdAt: string
}

/** GET /reviews/mine — E07-02. */
export interface MyReview {
  id: string
  bookingId: string
  rating: number
  text: string | null
  isAnonymous: boolean
  photoUrls: string[]
  /** Decided by the server's clock, not the device's. */
  isEditable: boolean
  editableUntil: string
  reply: ReviewReply | null
  pitch: { id: string; name: string }
  company: { id: string; name: string }
  /** The day played, venue time. */
  bookingDate: string
  createdAt: string
}

/** GET /companies/:id/reviews — E07-05, for the manager. */
export interface ManagerReview {
  id: string
  rating: number
  text: string | null
  /** "Alexandru D.", or "Anonymous player": managers see what the public sees. */
  playerName: string
  photoUrls: string[]
  pitch: { id: string; name: string }
  reply: (ReviewReply & { editableUntil: string; isEditable: boolean }) | null
  reportCount: number
  /** This manager has already reported it. */
  reportedByMe: boolean
  createdAt: string
}

export interface ManagerReviewPage {
  items: ManagerReview[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export const ModerateReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REMOVE']),
  reason: z.string().max(300).optional(),
})

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>
export type ManagerReplyInput = z.infer<typeof ManagerReplySchema>
export type ReportReviewInput = z.infer<typeof ReportReviewSchema>
export type ReviewListQuery = z.infer<typeof ReviewListQuerySchema>
export type ManagerReviewQuery = z.infer<typeof ManagerReviewQuerySchema>
export type ModerateReviewInput = z.infer<typeof ModerateReviewSchema>
