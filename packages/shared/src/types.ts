/**
 * Shared domain types.
 *
 * These mirror the Prisma enums in apps/web/prisma/schema.prisma exactly.
 * Mobile cannot import @prisma/client, so the names are duplicated here and
 * must be kept in sync by hand. PRD §13 is the source of truth for both.
 */

export type UserRole = 'PLAYER' | 'MANAGER' | 'ADMIN'

export type CompanyStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export type DisputeStatus = 'NONE' | 'OPEN' | 'RESOLVED_PLAYER' | 'RESOLVED_MANAGER'

export type ModerationStatus = 'APPROVED' | 'PENDING' | 'REMOVED'

export type SurfaceType = 'NATURAL_GRASS' | 'ARTIFICIAL_GRASS' | 'FUTSAL'

export type PitchSize = 'FIVE_A_SIDE' | 'SEVEN_A_SIDE' | 'ELEVEN_A_SIDE' | 'CUSTOM'

export type CancelledBy = 'PLAYER' | 'MANAGER' | 'ADMIN' | 'SYSTEM'

export type AmenityType =
  | 'SHOWERS_FREE'
  | 'SHOWERS_PAID'
  | 'CHANGING_ROOMS'
  | 'PARKING_FREE'
  | 'PARKING_PAID'
  | 'NIGHT_LIGHTING'
  | 'BALL_RENTAL_FREE'
  | 'BALL_RENTAL_PAID'
  | 'REFRESHMENTS'
  | 'LOCKERS'
  | 'REFEREE'
  | 'FIRST_AID'
  | 'WHEELCHAIR'
  | 'WIFI'

export type ShirtColour =
  'RED' | 'BLUE' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'WHITE' | 'BLACK' | 'PURPLE'

export type TrustScoreReason =
  | 'BOOKING_COMPLETED'
  | 'REVIEW_LEFT'
  | 'LATE_CANCEL'
  | 'VERY_LATE_CANCEL'
  | 'NO_SHOW'
  | 'DISPUTE_WON'
  | 'MONTHLY_RECOVERY'

export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_REMINDER_24H'
  | 'BOOKING_REMINDER_2H'
  | 'BOOKING_CANCELLED_PLAYER'
  | 'BOOKING_CANCELLED_MANAGER'
  | 'REFUND_PROCESSED'
  | 'NO_SHOW_REPORTED'
  | 'PENALTY_CHARGED'
  | 'DISPUTE_RESOLVED'
  | 'REVIEW_LEFT'
  | 'MANAGER_REPLIED'
  | 'OTP'
  | 'PASSWORD_RESET'

/** Trust tier labels. PRD §9.1. */
export type TrustTierLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Suspended'
