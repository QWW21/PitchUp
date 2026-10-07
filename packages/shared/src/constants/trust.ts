import type { TrustScoreReason, TrustTierLabel } from '../types'

/**
 * Trust score deltas. PRD §9.1.
 *
 * Keys match the TrustScoreReason enum in the Prisma schema, so a
 * TrustScoreEvent's reason indexes directly into this map.
 */
export const TRUST_SCORE_DELTAS: Record<TrustScoreReason, number> = {
  BOOKING_COMPLETED: 2,
  REVIEW_LEFT: 1,
  LATE_CANCEL: -5,
  VERY_LATE_CANCEL: -10,
  NO_SHOW: -20,
  DISPUTE_WON: 10,
  MONTHLY_RECOVERY: 1,
}

export const TRUST_SCORE_INITIAL = 100
export const TRUST_SCORE_MIN = 0
export const TRUST_SCORE_MAX = 100

/** Cap on positive score from completed bookings per calendar month. PRD §9.1. */
export const TRUST_SCORE_MONTHLY_COMPLETION_CAP = 10

export interface TrustTier {
  readonly label: TrustTierLabel
  readonly min: number
  readonly max: number
  /** Player may create new bookings at this tier. */
  readonly canBook: boolean
  /** Player must have a card on file before booking. */
  readonly requiresCardOnFile: boolean
  /** Player must pay 100% upfront as a deposit. */
  readonly requiresUpfrontDeposit: boolean
  /** Max simultaneously active bookings, or null for no limit. */
  readonly maxActiveBookings: number | null
}

/** Trust tiers, highest first. PRD §9.1. */
export const TRUST_TIERS: readonly TrustTier[] = [
  {
    label: 'Excellent',
    min: 90,
    max: 100,
    canBook: true,
    requiresCardOnFile: false,
    requiresUpfrontDeposit: false,
    maxActiveBookings: null,
  },
  {
    label: 'Good',
    min: 70,
    max: 89,
    canBook: true,
    requiresCardOnFile: false,
    requiresUpfrontDeposit: false,
    maxActiveBookings: null,
  },
  {
    label: 'Fair',
    min: 50,
    max: 69,
    canBook: true,
    requiresCardOnFile: true,
    requiresUpfrontDeposit: false,
    maxActiveBookings: null,
  },
  {
    label: 'Poor',
    min: 30,
    max: 49,
    canBook: true,
    requiresCardOnFile: true,
    requiresUpfrontDeposit: true,
    maxActiveBookings: 1,
  },
  {
    label: 'Suspended',
    min: 0,
    max: 29,
    canBook: false,
    requiresCardOnFile: false,
    requiresUpfrontDeposit: false,
    maxActiveBookings: 0,
  },
] as const
