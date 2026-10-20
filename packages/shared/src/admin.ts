/**
 * The admin panel — E15. What admins list, filter and change: venues, users
 * (with trust adjustments and suspension), disputes, reviews, the platform's
 * figures and its settings.
 */
import { z } from 'zod'
import type { TrustScoreReason, TrustTierLabel } from './types'
import { sharedT } from './i18n'
import type { Locale } from './i18n/core'

const cursor = z.string().min(1).max(60).optional()
const limit = z.coerce.number().int().min(1).max(50).default(20)
const search = z.string().trim().min(2, 'v.type2chars').max(80).optional()

// ── Venues (E15-01, E15-02) ────────────────────────────────────────────────

export const COMPANY_STATUSES = ['DRAFT', 'PENDING', 'ACTIVE', 'SUSPENDED'] as const
export type CompanyStatusName = (typeof COMPANY_STATUSES)[number]

/** "Live", "Waiting for approval"…, by `companyStatus.<STATUS>`. */
export const companyStatusLabel = (status: CompanyStatusName, locale: Locale): string =>
  sharedT(locale)(`companyStatus.${status}`)

/** GET /admin/companies — newest first. */
export const AdminCompanyQuerySchema = z.object({
  status: z.enum(COMPANY_STATUSES).optional(),
  search,
  cursor,
  limit,
})
export type AdminCompanyQuery = z.infer<typeof AdminCompanyQuerySchema>

export interface AdminCompanyRow {
  id: string
  name: string
  city: string | null
  status: CompanyStatusName
  manager: { id: string; name: string; email: string }
  pitchCount: number
  createdAt: string
  submittedAt: string | null
  /** New details wait for approval (C-13). */
  hasChanges: boolean
  stripeConnected: boolean
}

export interface AdminCompanyPage {
  items: AdminCompanyRow[]
  nextCursor: string | null
}

/**
 * Which status a venue may move to, and from where (E15-02). Sending back
 * to DRAFT is the "reject" of the tickets: the manager fixes and resubmits.
 */
export const COMPANY_TRANSITIONS: Record<CompanyStatusName, CompanyStatusName[]> = {
  DRAFT: [],
  PENDING: ['ACTIVE', 'DRAFT'],
  ACTIVE: ['SUSPENDED'],
  SUSPENDED: ['ACTIVE'],
}

/** PUT /admin/companies/:id/status — a reason is needed to send back or suspend. */
export const CompanyStatusUpdateSchema = z
  .object({
    status: z.enum(['ACTIVE', 'DRAFT', 'SUSPENDED']),
    reason: z.string().trim().min(5, 'v.sayWhyFew').max(500).optional(),
  })
  .refine(v => v.status === 'ACTIVE' || !!v.reason, {
    message: 'v.sayWhy',
    path: ['reason'],
  })
export type CompanyStatusUpdate = z.infer<typeof CompanyStatusUpdateSchema>

// ── Users (E15-03) ──────────────────────────────────────────────────────────

export const ADMIN_USER_STATUSES = ['active', 'suspended', 'deleted'] as const

export const AdminUserQuerySchema = z.object({
  search,
  role: z.enum(['PLAYER', 'MANAGER', 'ADMIN']).optional(),
  tier: z.enum(['Excellent', 'Good', 'Fair', 'Poor', 'Suspended']).optional(),
  status: z.enum(ADMIN_USER_STATUSES).optional(),
  cursor,
  limit,
})
export type AdminUserQuery = z.infer<typeof AdminUserQuerySchema>

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: 'PLAYER' | 'MANAGER' | 'ADMIN'
  trustScore: number
  tier: TrustTierLabel
  bookings: number
  suspendedAt: string | null
  deletedAt: string | null
  createdAt: string
}

export interface AdminUserPage {
  items: AdminUserRow[]
  nextCursor: string | null
}

export interface AdminUserDetail extends AdminUserRow {
  phone: string
  emailVerified: boolean
  phoneVerified: boolean
  suspensionReason: string | null
  company: { id: string; name: string; status: CompanyStatusName } | null
  stats: {
    completed: number
    upcoming: number
    cancelled: number
    noShows: number
    lateCancels: number
  }
  /** The latest score changes, newest first. */
  trustHistory: {
    id: string
    reason: TrustScoreReason
    label: string
    delta: number
    note: string | null
    at: string
  }[]
}

/** PUT /admin/users/:id — suspend or reinstate, and/or adjust the score with a reason. */
export const AdminUserUpdateSchema = z
  .object({
    suspended: z.boolean().optional(),
    suspensionReason: z.string().trim().min(5).max(300).optional(),
    trustScoreAdjust: z
      .number()
      .int()
      .min(-100)
      .max(100)
      .refine(n => n !== 0, 'v.adjustOnePoint')
      .optional(),
    trustAdjustReason: z.string().trim().min(5, 'v.sayWhyFew').max(200).optional(),
  })
  .refine(v => Object.values(v).some(x => x !== undefined), { message: 'v.nothingToChange' })
  .refine(v => v.trustScoreAdjust === undefined || !!v.trustAdjustReason, {
    message: 'v.sayWhyScore',
    path: ['trustAdjustReason'],
  })
  .refine(v => v.suspended !== true || !!v.suspensionReason, {
    message: 'v.sayWhySuspended',
    path: ['suspensionReason'],
  })
export type AdminUserUpdate = z.infer<typeof AdminUserUpdateSchema>

/** DELETE /admin/users/:id — players only; a reason for the record. */
export const AdminDeleteUserSchema = z.object({
  reason: z.string().trim().min(5).max(300),
})

// ── Disputes and reviews (E15-04) ───────────────────────────────────────────

export const AdminDisputeQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('open'),
})

export const AdminReviewQuerySchema = z.object({
  /** At least this many reports; 0 lists every review. */
  minReports: z.coerce.number().int().min(0).max(3).default(1),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search,
  cursor,
  limit,
})
export type AdminReviewQuery = z.infer<typeof AdminReviewQuerySchema>

export interface AdminReviewRow {
  id: string
  rating: number
  text: string | null
  createdAt: string
  pitch: { id: string; name: string; venue: string }
  player: { id: string; name: string }
  reports: number
  /** The latest report's category, when reported. */
  flagReason: string | null
  managerReply: string | null
}

export interface AdminReviewPage {
  items: AdminReviewRow[]
  nextCursor: string | null
}

export const AdminDeleteReviewSchema = z.object({
  reason: z.string().trim().min(10, 'v.tellAuthorWhy').max(300),
})

// ── Overview and settings (E15-05) ──────────────────────────────────────────

/** GET /admin/stats */
export interface AdminStats {
  users: number
  players: number
  managers: number
  suspendedUsers: number
  companies: { total: number; active: number; pending: number; suspended: number }
  venueChanges: number
  activePitches: number
  /** Played bookings (completed, or confirmed and started). */
  bookings: number
  openDisputes: number
  reportedReviews: number
  /** Value of played bookings, all time and the last 30 days, in RON. */
  gmv: number
  last30dGmv: number
  /** PitchUp's commission on those. */
  fees: number
}

export interface PlatformConfigView {
  platformFeePercent: number
  maintenanceMode: boolean
  maintenanceMessage: string
  updatedAt: string | null
}

/** PUT /admin/config — only what is sent changes. */
export const PlatformConfigSchema = z
  .object({
    platformFeePercent: z.number().int().min(0).max(20),
    maintenanceMode: z.boolean(),
    maintenanceMessage: z.string().trim().min(10).max(500),
  })
  .partial()
  .refine(v => Object.keys(v).length > 0, { message: 'v.nothingToChange' })
export type PlatformConfigInput = z.infer<typeof PlatformConfigSchema>
