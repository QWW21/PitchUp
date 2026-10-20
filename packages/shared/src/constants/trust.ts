import type { TrustScoreReason, TrustTierLabel } from '../types'
import { sharedT } from '../i18n'
import type { Locale } from '../i18n/core'

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
  /** E15: varies; the admin chooses the points, and the event records them. */
  ADMIN_ADJUSTMENT: 0,
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

/** Ring and badge colour per tier (UIUX_SPEC §10.2). */
export const TRUST_TIER_COLOURS: Record<TrustTierLabel, string> = {
  Excellent: '#16A34A',
  Good: '#22C55E',
  Fair: '#F59E0B',
  Poor: '#EF4444',
  Suspended: '#7F1D1D',
}

/** What a tier means for the player, in a sentence. Built from the rules above. */
export function tierDescription(tier: TrustTier, locale: Locale): string {
  const t = sharedT(locale)
  if (!tier.canBook) return t('trust.rule.suspended')
  const rules: string[] = []
  if (tier.requiresUpfrontDeposit) rules.push(t('trust.rule.upfront'))
  else if (tier.requiresCardOnFile) rules.push(t('trust.rule.cardOnFile'))
  if (tier.maxActiveBookings !== null) {
    rules.push(t('trust.rule.maxActive', { count: tier.maxActiveBookings }))
  }
  if (!rules.length) return t('trust.rule.none')
  const text = rules.join(', ')
  return `${text[0]!.toUpperCase()}${text.slice(1)}.`
}

/** How a score event reads in the history (E08-05). */
export const trustReasonLabel = (reason: TrustScoreReason, locale: Locale): string =>
  sharedT(locale)(`trust.reason.${reason}`)

/** A tier's name in the language: tiers are identified by their English label. */
export const tierName = (label: TrustTierLabel, locale: Locale): string =>
  sharedT(locale)(`trust.tier.${label}`)

/** "90–100", or "< 30" for the bottom tier. */
export const tierRange = (tier: TrustTier): string =>
  tier.min === 0 ? `< ${tier.max + 1}` : `${tier.min}–${tier.max}`

/**
 * The tier for a score. Derived on every read rather than stored, so it can
 * never disagree with the score (docs/ARCHITECTURE.md, "Derived versus stored").
 */
export function trustTier(score: number): TrustTier {
  return TRUST_TIERS.find(t => score >= t.min) ?? TRUST_TIERS[TRUST_TIERS.length - 1]!
}
