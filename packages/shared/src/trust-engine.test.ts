import { describe, expect, it } from 'vitest'
import {
  TRUST_SCORE_DELTAS,
  bookingTrustGate,
  deriveTier,
  lateCancelReason,
  meetsMinScore,
  replayTrustScore,
} from './index'

describe('the deltas (PRD §9.1)', () => {
  it('match the PRD', () => {
    expect(TRUST_SCORE_DELTAS).toEqual({
      BOOKING_COMPLETED: 2,
      REVIEW_LEFT: 1,
      LATE_CANCEL: -5,
      VERY_LATE_CANCEL: -10,
      NO_SHOW: -20,
      DISPUTE_WON: 10,
      MONTHLY_RECOVERY: 1,
    })
  })
})

describe('deriveTier', () => {
  it.each([
    [0, 'Suspended'],
    [29, 'Suspended'],
    [30, 'Poor'],
    [49, 'Poor'],
    [50, 'Fair'],
    [69, 'Fair'],
    [70, 'Good'],
    [89, 'Good'],
    [90, 'Excellent'],
    [100, 'Excellent'],
  ])('score %i is %s', (score, tier) => {
    expect(deriveTier(score)).toBe(tier)
  })
})

describe('replayTrustScore (E12-05)', () => {
  it('rebuilds a score from its events: 100 − 20 + 1 + 2 = 83', () => {
    expect(replayTrustScore([-20, 1, 2])).toBe(83)
    expect(deriveTier(83)).toBe('Good')
  })

  it('clamps at every step, as the live score does', () => {
    // +2 at 100 is lost, then −20.
    expect(replayTrustScore([2, -20])).toBe(80)
    expect(replayTrustScore([-20, -20, -20, -20, -20, -20, 10])).toBe(10)
    expect(replayTrustScore([])).toBe(100)
  })
})

describe('lateCancelReason (E12-03)', () => {
  it('−10 under 2 hours, −5 under 12, nothing from 12 (C-9)', () => {
    expect(lateCancelReason(1.99)).toBe('VERY_LATE_CANCEL')
    expect(lateCancelReason(2)).toBe('LATE_CANCEL')
    expect(lateCancelReason(11.9)).toBe('LATE_CANCEL')
    expect(lateCancelReason(12)).toBeNull()
    expect(lateCancelReason(23)).toBeNull()
  })
})

describe('meetsMinScore and the booking gate (E12-06)', () => {
  it('a minimum is a score to reach', () => {
    expect(meetsMinScore(70, 70)).toBe(true)
    expect(meetsMinScore(69, 70)).toBe(false)
    expect(meetsMinScore(10, 0)).toBe(true)
  })

  it('suspended players are refused everywhere', () => {
    expect(bookingTrustGate({ score: 29, pitchMinScore: 0, activeBookings: 0 })).toMatchObject({
      reason: 'TRUST_SCORE_TOO_LOW',
    })
  })

  it('a pitch asking for Good refuses Fair, saying both tiers', () => {
    expect(bookingTrustGate({ score: 65, pitchMinScore: 70, activeBookings: 0 })).toMatchObject({
      reason: 'TRUST_TIER_INSUFFICIENT',
      required: 'Good',
      current: 'Fair',
    })
    expect(bookingTrustGate({ score: 75, pitchMinScore: 70, activeBookings: 3 })).toBeNull()
  })

  it('Poor players hold one upcoming booking at a time', () => {
    expect(bookingTrustGate({ score: 40, pitchMinScore: 0, activeBookings: 0 })).toBeNull()
    expect(bookingTrustGate({ score: 40, pitchMinScore: 0, activeBookings: 1 })).toMatchObject({
      reason: 'ACTIVE_BOOKING_LIMIT',
    })
  })
})
