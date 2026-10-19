/**
 * Response contracts for the E04 detail endpoints, shared by web and mobile.
 */
import type { AmenityType, PitchSize, ShirtColour, SurfaceType } from '../types'
import type { DayHours } from '../schedule'

/** A pitch as listed on its company's page. GET /companies/:id. */
export interface PitchSummary {
  id: string
  name: string
  surfaceType: SurfaceType
  size: PitchSize
  /** RON per hour, the same at any time of day. */
  hourlyRate: number
  coverPhotoUrl: string | null
  /** Null below REVIEW.MIN_FOR_PUBLIC_RATING reviews. */
  avgRating: number | null
  reviewCount: number
  isActive: boolean
}

/** GET /api/v1/companies/:id — E04-01. */
export interface CompanyDetail {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  websiteUrl: string | null
  phone: string | null
  email: string
  addressLine1: string
  addressLine2: string | null
  city: string
  country: string
  postalCode: string | null
  lat: number | null
  lng: number | null
  /** Always seven entries, Sunday first; closed days have isClosed. */
  workingHours: DayHours[]
  isVerified: boolean
  isOpenNow: boolean
  avgRating: number | null
  reviewCount: number
  pitches: PitchSummary[]
}

export interface ReviewItem {
  id: string
  pitchId: string
  pitchName: string
  rating: number
  text: string | null
  isAnonymous: boolean
  /** "Alexandru D.", or "Anonymous player". */
  playerName: string
  playerAvatarUrl: string | null
  photoUrls: string[]
  managerReply: string | null
  managerRepliedAt: string | null
  createdAt: string
}

/** GET /api/v1/pitches/:id — E04-02. */
export interface PitchDetail {
  id: string
  name: string
  description: string | null
  surfaceType: SurfaceType
  size: PitchSize
  widthMeters: number | null
  lengthMeters: number | null
  isActive: boolean
  /** RON per hour, the same at any time of day. */
  hourlyRate: number
  minBookingHours: number
  maxBookingHours: number
  advanceBookingDays: number
  /** The lowest trust score that may book (E12-06); 0 = anyone allowed to book. */
  minTrustScore: number
  /** Shirts are free; a booking asks for teamCount - 1 sets. */
  hasShirts: boolean
  photos: { id: string; url: string; order: number }[]
  amenities: { amenityType: AmenityType; isPaid: boolean; price: number | null }[]
  /** Sets per colour; one set dresses one team. Empty when hasShirts is false. */
  shirtInventory: { colour: ShirtColour; quantity: number }[]
  avgRating: number | null
  reviewCount: number
  recentReviews: ReviewItem[]
  company: {
    id: string
    name: string
    logoUrl: string | null
    isVerified: boolean
    /** C-10: the venue's refund policy, in a sentence. */
    refundPolicy: string
    /** C-13: false when the venue confirms each booking by hand. */
    autoApproveBookings: boolean
  }
  /** The pitch is bookable during its company's working hours. */
  workingHours: DayHours[]
  /** False when the pitch is inactive or its company is not approved. */
  isBookable: boolean
}

/**
 * `past` marks a slot earlier today that has already started: neither
 * bookable nor booked. The tickets have no such state; without it every
 * past slot would read as available.
 */
export type SlotStatus = 'available' | 'booked' | 'past'

/** GET /api/v1/pitches/:id/availability?date= — E04-03. */
export interface PitchAvailability {
  date: string
  pitchId: string
  isClosed: boolean
  /** First and last slot boundary, venue time; null when closed. */
  openTime: string | null
  closeTime: string | null
  slots: { time: string; status: SlotStatus }[]
}

/** GET /api/v1/reviews — E04-07. */
export interface ReviewPage {
  reviews: ReviewItem[]
  page: number
  limit: number
  total: number
  hasMore: boolean
  /** Same visibility rule as everywhere: null below three reviews. */
  avgRating: number | null
  /** Count of reviews per star, 1–5. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
}
