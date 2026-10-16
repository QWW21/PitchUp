/**
 * The trust engine's rules — E12. The deltas, tiers and labels live in
 * constants/trust.ts (E01, PRD §9.1); these are the decisions built on them,
 * shared by the API (which enforces them) and the apps (which explain them).
 */
import { CANCELLATION_WINDOWS } from './constants/cancellation'
import { TRUST_SCORE_INITIAL, TRUST_SCORE_MAX, TRUST_SCORE_MIN, trustTier } from './constants/trust'
import type { TrustScoreReason, TrustTierLabel } from './types'

/** The tier's name for a score (E12-01). Derived, never stored. */
export const deriveTier = (score: number): TrustTierLabel => trustTier(score).label

export const clampTrust = (score: number): number =>
  Math.max(TRUST_SCORE_MIN, Math.min(TRUST_SCORE_MAX, score))

/**
 * A score rebuilt from its events, oldest first, clamping at every step as
 * the live score does (E12-05). Summing first and clamping once would differ:
 * +2 at 100 is lost, so 100, +2, −20 is 80, not 82.
 */
export const replayTrustScore = (deltas: number[], start = TRUST_SCORE_INITIAL): number =>
  deltas.reduce((score, delta) => clampTrust(score + delta), start)

/** A player cancelling this long before kick-off loses trust (E12-03; PRD §9.1). */
export function lateCancelReason(
  hoursBeforeStart: number
): Extract<TrustScoreReason, 'LATE_CANCEL' | 'VERY_LATE_CANCEL'> | null {
  if (hoursBeforeStart < CANCELLATION_WINDOWS.PARTIAL_REFUND_HOURS) return 'VERY_LATE_CANCEL'
  if (hoursBeforeStart < CANCELLATION_WINDOWS.FULL_REFUND_HOURS) return 'LATE_CANCEL'
  return null
}

/** The minimums a venue can set on a pitch (E12-09): a tier's lower bound. */
export const MIN_TRUST_OPTIONS = [
  { score: 0, label: 'Anyone who can book' },
  { score: 50, label: 'Fair and above' },
  { score: 70, label: 'Good and above' },
  { score: 90, label: 'Excellent only' },
] as const
export const MIN_TRUST_SCORES = MIN_TRUST_OPTIONS.map(o => o.score)

/** Whether a score reaches a pitch's minimum (E12-06). */
export const meetsMinScore = (score: number, minScore: number): boolean => score >= minScore

export type TrustGateReason =
  'TRUST_SCORE_TOO_LOW' | 'TRUST_TIER_INSUFFICIENT' | 'ACTIVE_BOOKING_LIMIT'

export interface TrustGate {
  reason: TrustGateReason
  message: string
  /** For TRUST_TIER_INSUFFICIENT: the tier the pitch asks for, and the player's. */
  required?: TrustTierLabel
  current?: TrustTierLabel
}

/**
 * Why this player may not book this pitch now, or null when they may
 * (E12-06, PRD §9.1). Suspended players can't book anywhere; Poor players
 * may hold one active booking; a pitch may ask for a higher tier.
 */
export function bookingTrustGate(input: {
  score: number
  pitchMinScore: number
  activeBookings: number
}): TrustGate | null {
  const tier = trustTier(input.score)
  if (!tier.canBook) {
    return { reason: 'TRUST_SCORE_TOO_LOW', message: 'Your account cannot make bookings right now' }
  }
  if (!meetsMinScore(input.score, input.pitchMinScore)) {
    const required = deriveTier(input.pitchMinScore)
    return {
      reason: 'TRUST_TIER_INSUFFICIENT',
      message: `This pitch is for players with a ${required} trust score or better. Yours is ${tier.label}.`,
      required,
      current: tier.label,
    }
  }
  if (tier.maxActiveBookings !== null && input.activeBookings >= tier.maxActiveBookings) {
    return {
      reason: 'ACTIVE_BOOKING_LIMIT',
      message: `At your trust score you can have ${tier.maxActiveBookings} upcoming booking at a time. Play or cancel it first.`,
    }
  }
  return null
}
