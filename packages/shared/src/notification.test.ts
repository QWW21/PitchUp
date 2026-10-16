import { describe, expect, it } from 'vitest'
import {
  MUTABLE_NOTIFICATION_TYPES,
  NOTIFICATION_PREFERENCE_GROUPS,
  NotificationListQuerySchema,
  NotificationPreferencesSchema,
  notificationTarget,
  notificationWebPath,
  preferenceGroupsFor,
} from './index'

describe('where a notification leads (E13)', () => {
  it('on the web: an explicit link, then the type', () => {
    expect(notificationWebPath('BOOKING_CONFIRMED', { bookingId: 'b1' })).toBe('/my-bookings/b1')
    expect(
      notificationWebPath('BOOKING_CANCELLED_PLAYER', {
        bookingId: 'b1',
        link: '/manager/bookings/b1',
      })
    ).toBe('/manager/bookings/b1')
    expect(notificationWebPath('TRUST_TIER_CHANGED', {})).toBe('/profile/trust-score')
    expect(notificationWebPath('MANAGER_REPLIED', { reviewId: 'r' })).toBe('/my-reviews')
    // Only paths on this site.
    expect(notificationWebPath('REVIEW_LEFT', { link: 'https://evil.example' })).toBe(
      '/profile/notifications'
    )
  })

  it('in the app: a tier change opens the trust score', () => {
    expect(notificationTarget('TRUST_TIER_CHANGED', {})).toEqual({ screen: 'TrustScore' })
  })

  it("a venue's booking notice opens the venue's view of it (C-11)", () => {
    const data = { bookingId: 'b1', link: '/manager/bookings/b1' }
    expect(notificationTarget('BOOKING_REQUESTED', data)).toEqual({
      screen: 'ManagerBookingDetail',
      params: { id: 'b1' },
    })
    expect(notificationWebPath('BOOKING_REQUESTED', data)).toBe('/manager/bookings/b1')
    expect(notificationTarget('BOOKING_AWAITING_APPROVAL', { bookingId: 'b1' })).toEqual({
      screen: 'BookingDetail',
      params: { id: 'b1' },
    })
  })
})

describe('preferences (E13-07)', () => {
  it('only the mutable kinds can be muted, and something must change', () => {
    expect(NotificationPreferencesSchema.safeParse({}).success).toBe(false)
    expect(NotificationPreferencesSchema.safeParse({ emailEnabled: false }).success).toBe(true)
    expect(
      NotificationPreferencesSchema.safeParse({ disabledTypes: ['BOOKING_REMINDER_24H'] }).success
    ).toBe(true)
    expect(
      NotificationPreferencesSchema.safeParse({ disabledTypes: ['COMPANY_APPROVED'] }).success
    ).toBe(false)
  })

  it('every group has types, and none is in two groups', () => {
    const all = NOTIFICATION_PREFERENCE_GROUPS.flatMap(g => g.types)
    expect(new Set(all).size).toBe(all.length)
    expect(MUTABLE_NOTIFICATION_TYPES).toEqual(all)
  })

  it('new bookings can be muted by managers only', () => {
    expect(preferenceGroupsFor('PLAYER').map(g => g.key)).not.toContain('new-bookings')
    expect(preferenceGroupsFor('MANAGER').map(g => g.key)).toContain('new-bookings')
    // A request needs an answer, so it can't be muted.
    expect(MUTABLE_NOTIFICATION_TYPES).not.toContain('BOOKING_REQUESTED')
  })

  it('the inbox can list unread ones only', () => {
    expect(NotificationListQuerySchema.parse({ unreadOnly: 'true' }).unreadOnly).toBe(true)
    expect(NotificationListQuerySchema.parse({}).unreadOnly).toBe(false)
  })
})
