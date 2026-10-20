import { describe, expect, it } from 'vitest'
import {
  ChangeOwnPasswordSchema,
  TRUST_TIERS,
  UpdateProfileSchema,
  notificationTarget,
  tierDescription,
  tierRange,
  trustTier,
} from './index'

describe('trust tiers in words (E08-02)', () => {
  it('describes what each tier allows, from the rules themselves', () => {
    expect(TRUST_TIERS.map(t => [t.label, tierRange(t), tierDescription(t, 'en')])).toEqual([
      ['Excellent', '90–100', 'No restrictions.'],
      ['Good', '70–89', 'No restrictions.'],
      ['Fair', '50–69', 'A card on file is required.'],
      ['Poor', '30–49', 'Full payment upfront, at most 1 active booking.'],
      ['Suspended', '< 30', 'Booking is suspended. Contact support.'],
    ])
  })
  it('the boundaries: 90, 70, 50, 30 and 29', () => {
    expect([90, 89, 70, 69, 50, 49, 30, 29, 0].map(s => trustTier(s).label)).toEqual([
      'Excellent',
      'Good',
      'Good',
      'Fair',
      'Fair',
      'Poor',
      'Poor',
      'Suspended',
      'Suspended',
    ])
  })
})

describe('profile updates (E08-01)', () => {
  it('takes any subset, but not nothing', () => {
    expect(UpdateProfileSchema.safeParse({ name: 'Ana Pop' }).success).toBe(true)
    expect(UpdateProfileSchema.safeParse({}).success).toBe(false)
  })
  it('cities come from the list; photos only from Cloudinary; null removes the photo', () => {
    expect(UpdateProfileSchema.safeParse({ city: 'Cluj-Napoca' }).success).toBe(true)
    expect(UpdateProfileSchema.safeParse({ city: 'Atlantis' }).success).toBe(false)
    expect(
      UpdateProfileSchema.safeParse({
        avatarUrl: 'https://res.cloudinary.com/x/image/upload/a.jpg',
      }).success
    ).toBe(true)
    expect(UpdateProfileSchema.safeParse({ avatarUrl: 'https://evil.example/a.jpg' }).success).toBe(
      false
    )
    expect(UpdateProfileSchema.safeParse({ avatarUrl: null }).success).toBe(true)
  })
  it('drops fields that are not editable here', () => {
    const r = UpdateProfileSchema.parse({ name: 'Ana Pop', email: 'x@y.ro', role: 'ADMIN' })
    expect(r).toEqual({ name: 'Ana Pop' })
  })
})

describe('changing the password (E08-03)', () => {
  it('needs a strong new password that differs from the current one', () => {
    const ok = { currentPassword: 'OldPass123', newPassword: 'NewPass123' }
    expect(ChangeOwnPasswordSchema.safeParse(ok).success).toBe(true)
    expect(ChangeOwnPasswordSchema.safeParse({ ...ok, newPassword: 'weak' }).success).toBe(false)
    expect(ChangeOwnPasswordSchema.safeParse({ ...ok, newPassword: 'OldPass123' }).success).toBe(
      false
    )
  })
})

describe('where a notification leads (E08-09, E08-10)', () => {
  it('booking news opens the booking, or My Bookings without an id', () => {
    expect(notificationTarget('BOOKING_CONFIRMED', { bookingId: 'b1' })).toEqual({
      screen: 'BookingDetail',
      params: { id: 'b1' },
    })
    expect(notificationTarget('REFUND_PROCESSED', {})).toEqual({ screen: 'MyBookings' })
  })
  it('a venue reply opens My reviews; anything else stays put', () => {
    expect(notificationTarget('MANAGER_REPLIED', { reviewId: 'r1' })).toEqual({
      screen: 'MyReviews',
    })
    expect(notificationTarget('OTP', null)).toBeNull()
    expect(notificationTarget('SOMETHING_NEW', {})).toBeNull()
  })
})
