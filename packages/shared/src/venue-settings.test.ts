import { describe, expect, it } from 'vitest'
import {
  approvalDeadline,
  ManagerCancelSchema,
  RefundPolicySchema,
  VenueBookingSettingsSchema,
} from './index'

describe("a venue's refund policy (C-10)", () => {
  it('whole hours, a week at most, and the partial window inside the full one', () => {
    const ok = { fullRefundHours: 12, partialRefundHours: 2, partialRefundPercent: 75 }
    expect(RefundPolicySchema.safeParse(ok).success).toBe(true)
    expect(RefundPolicySchema.safeParse({ ...ok, fullRefundHours: 169 }).success).toBe(false)
    expect(RefundPolicySchema.safeParse({ ...ok, fullRefundHours: 1.5 }).success).toBe(false)
    expect(RefundPolicySchema.safeParse({ ...ok, partialRefundHours: 13 }).success).toBe(false)
    expect(RefundPolicySchema.safeParse({ ...ok, partialRefundPercent: 101 }).success).toBe(false)
  })

  it('settings change only what is sent, and something must be sent', () => {
    expect(VenueBookingSettingsSchema.safeParse({}).success).toBe(false)
    expect(VenueBookingSettingsSchema.safeParse({ autoApproveBookings: false }).success).toBe(true)
  })
})

describe('answering a booking request (C-13)', () => {
  const at = (hhmm: string) => new Date(`2026-11-10T${hhmm}:00Z`)
  it('24 hours after paying, or 2 hours before kick-off, whichever is first', () => {
    const start = new Date('2026-11-14T18:00:00Z')
    expect(approvalDeadline(at('10:00'), start).toISOString()).toBe('2026-11-11T10:00:00.000Z')
    expect(approvalDeadline(at('10:00'), at('20:00')).toISOString()).toBe(
      '2026-11-10T18:00:00.000Z'
    )
  })
  it('booked inside the last 2 hours: until kick-off', () => {
    expect(approvalDeadline(at('17:00'), at('18:30')).toISOString()).toBe(
      '2026-11-10T18:30:00.000Z'
    )
  })
  it('a decline or cancellation says why', () => {
    expect(ManagerCancelSchema.safeParse({ reason: 'no' }).success).toBe(false)
    expect(ManagerCancelSchema.safeParse({ reason: 'The pitch is flooded' }).success).toBe(true)
  })
})
