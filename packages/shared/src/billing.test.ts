import { describe, expect, it } from 'vitest'
import { isSubscribed, subscriptionPrice, type BillingInterval } from './billing'

const firstPaidAt = new Date('2026-12-01T00:00:00Z')
const bill = (interval: BillingInterval, periodStart: string, activePitches = 1) =>
  subscriptionPrice({
    interval,
    firstPaidAt,
    periodStart: new Date(`${periodStart}T00:00:00Z`),
    activePitches,
  })

describe('subscriptionPrice', () => {
  it('charges the first year 10 a month or 100 a year', () => {
    expect(bill('MONTHLY', '2026-12-01')).toMatchObject({ total: 10, discounted: true })
    expect(bill('YEARLY', '2026-12-01')).toMatchObject({ total: 100, discounted: true })
  })

  it('is discounted before anything was paid (the first bill after the trial)', () => {
    const first = subscriptionPrice({
      interval: 'MONTHLY',
      firstPaidAt: null,
      periodStart: new Date('2026-12-01T00:00:00Z'),
      activePitches: 2,
    })
    expect(first.total).toBe(10)
  })

  it('charges 30 or 300 from the second year: the 13th month is the first at 30', () => {
    expect(bill('MONTHLY', '2027-11-01').total).toBe(10)
    expect(bill('MONTHLY', '2027-12-01')).toMatchObject({ total: 30, discounted: false })
    expect(bill('YEARLY', '2027-12-01').total).toBe(300)
  })

  it('adds 5 a month or 50 a year for each active pitch beyond two', () => {
    expect(bill('MONTHLY', '2026-12-01', 2).total).toBe(10)
    expect(bill('MONTHLY', '2026-12-01', 4)).toMatchObject({
      base: 10,
      extraPitches: 2,
      extraEach: 5,
      total: 20,
    })
    expect(bill('YEARLY', '2026-12-01', 4).total).toBe(200)
    expect(bill('MONTHLY', '2028-01-01', 3).total).toBe(35)
    expect(bill('MONTHLY', '2026-12-01', 0).total).toBe(10)
  })
})

describe('isSubscribed', () => {
  it('counts the trial, paid, grace and cancelling periods', () => {
    expect(
      ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLING'].every(s => isSubscribed(s as never))
    ).toBe(true)
    expect(isSubscribed('NONE')).toBe(false)
    expect(isSubscribed('PAUSED')).toBe(false)
  })
})
