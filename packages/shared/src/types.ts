export type UserRole = 'PLAYER' | 'MANAGER' | 'ADMIN'

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export type SurfaceType = 'NATURAL_GRASS' | 'ARTIFICIAL_GRASS' | 'FUTSAL'

export type PitchSize = '5V5' | '7V7' | '11V11' | 'CUSTOM'

export type CompanyStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED'

export type DisputeStatus =
  | 'NONE'
  | 'OPEN'
  | 'RESOLVED_PLAYER'
  | 'RESOLVED_MANAGER'

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
  | 'REVIEW_REPLIED'

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
  | 'WHEELCHAIR_ACCESSIBLE'
  | 'WIFI'

export type ShirtColour =
  | 'RED'
  | 'BLUE'
  | 'GREEN'
  | 'YELLOW'
  | 'ORANGE'
  | 'WHITE'
  | 'BLACK'
  | 'PURPLE'
