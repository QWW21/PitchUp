import type Stripe from 'stripe'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('./index', () => ({ recordPaid: vi.fn(), recordFailed: vi.fn() }))
vi.mock('./stripe-billing', async () => {
  const actual = await vi.importActual<typeof import('./stripe-billing')>('./stripe-billing')
  return { stripePeriodEnd: actual.stripePeriodEnd }
})
vi.mock('@/lib/payments/stripe', () => ({ stripe: vi.fn(), toBani: (n: number) => n * 100 }))

const { statusFromStripe } = await import('./webhook')
const { stripePeriodEnd } = await import('./stripe-billing')

const sub = (status: Stripe.Subscription.Status, cancel = false, end = 1_790_000_000) =>
  ({
    status,
    cancel_at_period_end: cancel,
    items: { data: [{ current_period_end: end }] },
  }) as unknown as Stripe.Subscription

describe("Stripe's subscription status as ours (C-15)", () => {
  it('maps every status', () => {
    expect(statusFromStripe(sub('trialing'))).toBe('TRIALING')
    expect(statusFromStripe(sub('active'))).toBe('ACTIVE')
    expect(statusFromStripe(sub('past_due'))).toBe('PAST_DUE')
    expect(statusFromStripe(sub('unpaid'))).toBe('PAST_DUE')
    expect(statusFromStripe(sub('canceled'))).toBe('PAUSED')
    expect(statusFromStripe(sub('paused'))).toBe('PAUSED')
  })

  it('a cancel at the period end is CANCELLING until then', () => {
    expect(statusFromStripe(sub('active', true))).toBe('CANCELLING')
    expect(statusFromStripe(sub('trialing', true))).toBe('CANCELLING')
  })

  it('leaves ours alone while Stripe waits for the card', () => {
    expect(statusFromStripe(sub('incomplete'))).toBeNull()
    expect(statusFromStripe(sub('incomplete_expired'))).toBeNull()
  })

  it("reads the period's end from the item (API version basil)", () => {
    expect(stripePeriodEnd(sub('active'))?.toISOString()).toBe('2026-09-21T14:13:20.000Z')
    expect(stripePeriodEnd({ items: { data: [] } } as unknown as Stripe.Subscription)).toBeNull()
  })
})
