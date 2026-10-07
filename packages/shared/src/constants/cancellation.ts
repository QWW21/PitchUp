/**
 * Cancellation windows and refund percentages. PRD §9.2.
 *
 * Hours are measured from "now" to the booking's start time.
 * A company may configure a stricter policy, never a looser one.
 */
export const CANCELLATION_WINDOWS = {
  /** At or beyond this many hours before start: full refund. */
  FULL_REFUND_HOURS: 24,
  /** At or beyond this many hours before start (but under FULL): partial refund. */
  PARTIAL_REFUND_HOURS: 2,
} as const

export const REFUND_PERCENTAGES = {
  FULL: 100,
  PARTIAL: 50,
  NONE: 0,
} as const
