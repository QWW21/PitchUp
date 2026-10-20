import { z } from 'zod'
import type { NotificationType } from '../types'

/** One notification in the in-app list — E08-09. */
export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string
  /** What it is about: bookingId, reviewId, pitchId… as the sender stored them. */
  data: Record<string, string>
  isRead: boolean
  createdAt: string
}

/** GET /notifications?cursor= */
export interface NotificationPage {
  items: NotificationItem[]
  nextCursor: string | null
  hasMore: boolean
  /** Unread in total, for the badge. */
  unread: number
}

export const NotificationListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  /** Unread ones only (E13-06). */
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform(v => v === 'true'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform(n => Math.min(n, 50)),
})

/** POST /notifications/device-token — E08-10. */
export const DeviceTokenSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['ios', 'android']),
})

/**
 * Where tapping a notification goes, from the list and from a push (E08-09,
 * E08-10). One plain function, so the rule is the same everywhere and tested.
 */
export type NotificationTarget =
  | { screen: 'BookingDetail'; params: { id: string } }
  | { screen: 'ManagerBookingDetail'; params: { id: string } }
  | { screen: 'MyReviews' }
  | { screen: 'MyBookings' }
  | { screen: 'TrustScore' }
  | null

const BOOKING_TYPES = new Set<string>([
  'BOOKING_CONFIRMED',
  'BOOKING_AWAITING_APPROVAL',
  'BOOKING_REMINDER_24H',
  'BOOKING_REMINDER_2H',
  'BOOKING_CANCELLED_PLAYER',
  'BOOKING_CANCELLED_MANAGER',
  'REFUND_PROCESSED',
  'NO_SHOW_REPORTED',
  'PENALTY_CHARGED',
  'DISPUTE_RESOLVED',
])

export function notificationTarget(
  type: string,
  data: Record<string, unknown> | null | undefined
): NotificationTarget {
  // A venue's notice about a booking opens the venue's view of it (C-11).
  const link = typeof data?.link === 'string' ? data.link : ''
  const managed = /^\/manager\/bookings\/([^/?#]+)$/.exec(link)
  if (managed) return { screen: 'ManagerBookingDetail', params: { id: managed[1]! } }
  if (BOOKING_TYPES.has(type)) {
    const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : null
    return bookingId
      ? { screen: 'BookingDetail', params: { id: bookingId } }
      : { screen: 'MyBookings' }
  }
  if (type === 'MANAGER_REPLIED') return { screen: 'MyReviews' }
  if (type === 'TRUST_TIER_CHANGED') return { screen: 'TrustScore' }
  return null
}

/**
 * The web page a notification is about: the bell's links and the email's
 * button (E13). `link` in the data wins, for notices whose page depends on
 * who receives them (a venue's view of a booking, not the player's).
 */
export function notificationWebPath(type: string, data: Record<string, unknown>): string {
  if (typeof data.link === 'string' && data.link.startsWith('/')) return data.link
  if (type === 'TRUST_TIER_CHANGED') return '/profile/trust-score'
  if (type === 'MANAGER_REPLIED') return '/my-reviews'
  const target = notificationTarget(type, data)
  if (target?.screen === 'BookingDetail') return `/my-bookings/${target.params.id}`
  if (target?.screen === 'MyBookings') return '/my-bookings'
  return '/profile/notifications'
}

// ── Preferences (E13-07) ─────────────────────────────────────────────────────

/**
 * What a person can mute, in groups people think in. Account notices (venue
 * approval, security codes) can't be muted.
 */
export const NOTIFICATION_PREFERENCE_GROUPS = [
  {
    key: 'confirmed',
    label: 'Booking confirmed',
    description: 'When a booking is paid and confirmed, or sent to the venue to confirm',
    types: ['BOOKING_CONFIRMED', 'BOOKING_AWAITING_APPROVAL'],
  },
  {
    key: 'new-bookings',
    label: 'New bookings',
    description: 'When a player books one of your pitches',
    types: ['BOOKING_RECEIVED'],
    managersOnly: true,
  },
  {
    key: 'reminders',
    label: 'Booking reminders',
    description: '24 hours before a game',
    types: ['BOOKING_REMINDER_24H', 'BOOKING_REMINDER_2H'],
  },
  {
    key: 'cancelled',
    label: 'Cancellations and refunds',
    description: 'When a booking is cancelled or money is refunded',
    types: ['BOOKING_CANCELLED_PLAYER', 'BOOKING_CANCELLED_MANAGER', 'REFUND_PROCESSED'],
  },
  {
    key: 'no-shows',
    label: 'No-shows and disputes',
    description: 'When a no-show is reported or a dispute is decided',
    types: ['NO_SHOW_REPORTED', 'DISPUTE_RESOLVED'],
  },
  {
    key: 'reviews',
    label: 'Reviews',
    description: 'New reviews of your pitches, and replies to your reviews',
    types: ['REVIEW_LEFT', 'MANAGER_REPLIED'],
  },
  {
    key: 'trust',
    label: 'Trust tier changes',
    description: 'When your trust tier goes up or down',
    types: ['TRUST_TIER_CHANGED'],
  },
] as const satisfies readonly {
  key: string
  label: string
  description: string
  types: readonly NotificationType[]
  /** Shown to venue managers only. */
  managersOnly?: boolean
}[]

/** The groups a person with this role can switch. */
export const preferenceGroupsFor = (role: string) =>
  NOTIFICATION_PREFERENCE_GROUPS.filter(g => !('managersOnly' in g) || role === 'MANAGER')

export const MUTABLE_NOTIFICATION_TYPES = NOTIFICATION_PREFERENCE_GROUPS.flatMap(
  g => g.types
) as NotificationType[]

/** GET /notifications/preferences. */
export interface NotificationPreferences {
  pushEnabled: boolean
  emailEnabled: boolean
  disabledTypes: NotificationType[]
}

/** PUT /notifications/preferences — only the fields sent change; disabledTypes is replaced whole. */
export const NotificationPreferencesSchema = z
  .object({
    pushEnabled: z.boolean(),
    emailEnabled: z.boolean(),
    disabledTypes: z
      .array(z.enum(MUTABLE_NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]]))
      .max(20),
  })
  .partial()
  .refine(p => Object.keys(p).length > 0, { message: 'v.nothingToChange' })
export type NotificationPreferencesInput = z.infer<typeof NotificationPreferencesSchema>
