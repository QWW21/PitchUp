/**
 * Cancellation rules. Hours are measured from "now" to the booking's start.
 *
 * Refunds are each venue's own policy (C-10): a full refund up to
 * `fullRefundHours` before kick-off, `partialRefundPercent` up to
 * `partialRefundHours`, nothing after. A booking keeps the policy it was made
 * under. This is the default a new venue starts with.
 *
 * The trust penalty for cancelling late is the same everywhere (C-9), so a
 * score means the same thing at every venue.
 */
export interface RefundPolicy {
  fullRefundHours: number
  partialRefundHours: number
  partialRefundPercent: number
}

export const DEFAULT_REFUND_POLICY: RefundPolicy = {
  fullRefundHours: 12,
  partialRefundHours: 2,
  partialRefundPercent: 75,
}

/** The limits a venue's policy must stay within. */
export const REFUND_POLICY_LIMITS = {
  /** A week: longer would hold a player's money hostage for too long. */
  MAX_FULL_REFUND_HOURS: 168,
} as const

/** Under this many hours: −5 (LATE_CANCEL). Under VERY_LATE: −10 instead. */
export const TRUST_LATE_CANCEL_HOURS = 12
export const TRUST_VERY_LATE_CANCEL_HOURS = 2
