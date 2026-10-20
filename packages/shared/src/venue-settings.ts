/**
 * A venue's own rules and details, changed in Settings — C-10 … C-13.
 *
 * - Refund policy (C-10): the venue's hours and percentage.
 * - Approving bookings (C-13): automatic by default, or each by hand; a
 *   request not answered in time is declined and refunded.
 * - The venue's details (C-13): edited after approval, they wait for an
 *   admin again; the live page keeps the approved details meanwhile.
 */
import { z } from 'zod'
import { REFUND_POLICY_LIMITS, type RefundPolicy } from './constants/cancellation'
import type {
  CompanyInfoInput,
  CompanyLocationInput,
  ContactHoursInput,
} from './schemas/onboarding'

export const RefundPolicySchema = z
  .object({
    fullRefundHours: z
      .number()
      .int('v.wholeHours')
      .min(0)
      .max(REFUND_POLICY_LIMITS.MAX_FULL_REFUND_HOURS, 'v.maxWeek'),
    partialRefundHours: z.number().int('v.wholeHours').min(0),
    partialRefundPercent: z.number().int('v.wholePercent').min(0).max(100),
  })
  .refine(p => p.partialRefundHours <= p.fullRefundHours, {
    message: 'v.partialAfterFull',
    path: ['partialRefundHours'],
  })

/** GET /manager/settings/bookings. */
export interface VenueBookingSettings {
  autoApproveBookings: boolean
  refundPolicy: RefundPolicy
}

/** PUT /manager/settings/bookings — only what is sent changes. */
export const VenueBookingSettingsSchema = z
  .object({ autoApproveBookings: z.boolean(), refundPolicy: RefundPolicySchema })
  .partial()
  .refine(v => Object.keys(v).length > 0, { message: 'v.nothingToChange' })
export type VenueBookingSettingsInput = z.infer<typeof VenueBookingSettingsSchema>

// ── Approving bookings by hand (C-13) ──────────────────────────────────────

export const BOOKING_APPROVAL = {
  /** A request is answered within this long after it is paid… */
  ANSWER_WITHIN_HOURS: 24,
  /** …and no later than this long before kick-off. */
  CUTOFF_HOURS_BEFORE_START: 2,
} as const

/**
 * When an unanswered request is declined: 24 hours after it was paid, or 2
 * hours before kick-off, whichever is first. A booking made later than that
 * cutoff can be answered until kick-off.
 */
export function approvalDeadline(paidAt: Date, start: Date): Date {
  const answerBy = paidAt.getTime() + BOOKING_APPROVAL.ANSWER_WITHIN_HOURS * 3_600_000
  const cutoff = start.getTime() - BOOKING_APPROVAL.CUTOFF_HOURS_BEFORE_START * 3_600_000
  if (cutoff <= paidAt.getTime()) return start
  return new Date(Math.min(answerBy, cutoff))
}

/** POST /manager/bookings/:id/cancel — declining a request, or cancelling a booking (C-12). */
export const ManagerCancelSchema = z.object({
  reason: z.string().trim().min(5, 'v.tellPlayerWhy').max(300),
})

// ── The venue's details (C-13) ──────────────────────────────────────────────

/** Proposed details, by section; a section not proposed is unchanged. */
export interface VenueProfileChanges {
  info?: CompanyInfoInput
  /** With the coordinates resolved when it was proposed. */
  location?: Omit<CompanyLocationInput, 'lat' | 'lng'> & { lat: number | null; lng: number | null }
  contactHours?: ContactHoursInput
}
export type VenueProfileSection = keyof VenueProfileChanges

/** GET /manager/venue — what waits for an admin, if anything. */
export interface VenueChangesStatus {
  pending: VenueProfileSection[]
  submittedAt: string | null
  /** Why an admin turned the last proposal down; cleared by the next one. */
  rejectionReason: string | null
}

/** One line of the admin's comparison. */
export interface VenueChangeLine {
  field: string
  before: string
  after: string
}

/** GET /admin/venue-changes. */
export interface PendingVenueChange {
  companyId: string
  companyName: string
  manager: { name: string; email: string }
  submittedAt: string
  lines: VenueChangeLine[]
}
