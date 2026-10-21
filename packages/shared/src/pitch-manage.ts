/**
 * Managing pitches — E10 (with C-1, C-2 and C-3). The schemas the manager's
 * pitch editor and the API share, and the rules both apply.
 */
import { z } from 'zod'
import { SHIRT_COLOURS } from './constants/shirts'
import { toMinutes, type DayHours } from './schedule'
import { MIN_TRUST_SCORES } from './trust-engine'
import type { AmenityType, PitchSize, ShirtColour, SurfaceType } from './types'
import { sharedT } from './i18n'
import type { Locale } from './i18n/core'

export const PITCH_LIMITS = {
  MAX_PHOTOS: 10,
  NAME_MAX: 60,
  DESCRIPTION_MAX: 1000,
  /** Client-side checks before an upload (E10-07). */
  PHOTO_MAX_BYTES: 5 * 1024 * 1024,
  PHOTO_MIN_WIDTH: 800,
  PHOTO_MIN_HEIGHT: 600,
  MAX_SETS_PER_COLOUR: 99,
} as const

/** Common Romanian pitch dimensions, in metres; filled in when a size is picked. */
export const PITCH_DEFAULT_DIMENSIONS: Record<
  Exclude<PitchSize, 'CUSTOM'>,
  { width: number; length: number }
> = {
  FIVE_A_SIDE: { width: 25, length: 42 },
  SIX_A_SIDE: { width: 30, length: 50 },
  SEVEN_A_SIDE: { width: 40, length: 60 },
  ELEVEN_A_SIDE: { width: 68, length: 105 },
}

export const PRICING_OPTIONS = {
  /** In hours, by half hours. */
  MIN_BOOKING_HOURS: [1, 1.5, 2],
  MAX_BOOKING_HOURS: [2, 2.5, 3, 3.5, 4],
  ADVANCE_BOOKING_DAYS: [30, 60, 90],
} as const

const surfaceType = z.enum(['NATURAL_GRASS', 'ARTIFICIAL_GRASS', 'FUTSAL'])
const size = z.enum(['FIVE_A_SIDE', 'SIX_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE', 'CUSTOM'])
const blankToUndefined = (v: unknown) =>
  v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v
const metres = z.number().positive('v.metres').max(200, 'v.max200m')

const basicFields = {
  name: z.string().trim().min(2, 'v.enterName').max(PITCH_LIMITS.NAME_MAX, 'v.nameMax'),
  surfaceType,
  size,
  widthMeters: metres.optional(),
  lengthMeters: metres.optional(),
  description: z.preprocess(
    blankToUndefined,
    z.string().trim().max(PITCH_LIMITS.DESCRIPTION_MAX).optional()
  ),
  /** Who may book (E12-09): a tier's lowest score, 0 for anyone allowed to book. */
  minTrustScore: z
    .number()
    .int()
    .refine(v => (MIN_TRUST_SCORES as number[]).includes(v), 'v.chooseOption')
    .optional(),
}

const customNeedsSize = (d: {
  size?: string | undefined
  widthMeters?: number | undefined
  lengthMeters?: number | undefined
}) => d.size !== 'CUSTOM' || (!!d.widthMeters && !!d.lengthMeters)

/** POST /pitches and the Basic info tab — E10-01. A new pitch starts inactive. */
export const PitchBasicInfoSchema = z.object(basicFields).refine(customNeedsSize, {
  message: 'v.customSize',
  path: ['widthMeters'],
})

/** PUT /pitches/:id — only the fields sent change. */
export const UpdatePitchBasicInfoSchema = z
  .object(basicFields)
  .partial()
  .refine(d => Object.keys(d).length > 0, { message: 'v.nothingToChange' })

export const PitchStatusSchema = z.object({ isActive: z.boolean() })

/** POST /pitches/:id/photos — the image is already on Cloudinary. */
export const AddPitchPhotoSchema = z.object({
  url: z
    .string()
    .url()
    .refine(u => u.startsWith('https://res.cloudinary.com/'), 'v.photoUpload'),
  cloudinaryPublicId: z.string().min(1).max(200),
})

/** PUT /pitches/:id/photos/reorder — every photo id, in the new order. */
export const ReorderPhotosSchema = z.object({
  photoIds: z.array(z.string().min(1)).min(1).max(PITCH_LIMITS.MAX_PHOTOS),
})

const amenityType = z.enum([
  'SHOWERS_FREE',
  'SHOWERS_PAID',
  'CHANGING_ROOMS',
  'PARKING_FREE',
  'PARKING_PAID',
  'NIGHT_LIGHTING',
  'BALL_RENTAL_FREE',
  'BALL_RENTAL_PAID',
  'REFRESHMENTS',
  'LOCKERS',
  'REFEREE',
  'FIRST_AID',
  'WHEELCHAIR',
  'WIFI',
])

/** PUT /pitches/:id/amenities — the whole set, replacing the old one. */
export const PitchAmenitiesSchema = z.object({
  amenities: z
    .array(amenityType)
    .max(14)
    .refine(a => new Set(a).size === a.length, 'v.amenityOnce'),
})

const oneOf = <T extends readonly number[]>(values: T, message: string) =>
  z.number().refine(v => (values as readonly number[]).includes(v), message)

const coveredRate = z
  .number({ invalid_type_error: 'v.enterPrice' })
  .min(1, 'v.priceAboveZero')
  .max(9999, 'v.max9999')
  .nullable()
  .optional()

/**
 * PUT /pitches/:id/pricing — one hourly rate (C-2), the covered prices
 * (C-14) and the booking limits. Covered rates left out stay as they are.
 */
export const PitchPricingSchema = z
  .object({
    hourlyRate: z
      .number({ invalid_type_error: 'v.enterPrice' })
      .positive('v.priceAboveZero')
      .max(9999, 'v.max9999'),
    minBookingHours: oneOf(PRICING_OPTIONS.MIN_BOOKING_HOURS, 'v.minBookingChoice'),
    maxBookingHours: oneOf(PRICING_OPTIONS.MAX_BOOKING_HOURS, 'v.maxBookingChoice'),
    advanceBookingDays: oneOf(PRICING_OPTIONS.ADVANCE_BOOKING_DAYS, 'v.advanceChoice'),
    /** C-14: full hourly prices while covered; null = that air is not offered. */
    coveredColdRate: coveredRate,
    coveredHotRate: coveredRate,
  })
  .refine(d => d.minBookingHours <= d.maxBookingHours, {
    message: 'v.shortestLongest',
    path: ['maxBookingHours'],
  })

/** PUT /pitches/:id/shirts — lend shirts or not, and sets per colour (C-1). Free. */
export const PitchShirtsSchema = z
  .object({
    hasShirts: z.boolean(),
    inventory: z
      .array(
        z.object({
          colour: z.enum(SHIRT_COLOURS as unknown as [ShirtColour, ...ShirtColour[]]),
          quantity: z.number().int().min(0).max(PITCH_LIMITS.MAX_SETS_PER_COLOUR),
        })
      )
      .max(SHIRT_COLOURS.length)
      .refine(i => new Set(i.map(c => c.colour)).size === i.length, 'v.colourOnce')
      .default([]),
    /** Save even though upcoming bookings were promised more sets than this. */
    force: z.boolean().optional(),
  })
  .refine(d => !d.hasShirts || d.inventory.some(c => c.quantity > 0), {
    message: 'v.addShirtSet',
    path: ['inventory'],
  })

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'v.useTime')

/** PUT /pitches/:id/availability — the pitch's own week, within the venue's hours. */
export const PitchHoursSchema = z.object({
  workingHours: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        openTime: time,
        closeTime: time,
        isClosed: z.boolean(),
      })
    )
    .length(7, 'v.sevenDays')
    .refine(d => new Set(d.map(x => x.day)).size === 7, 'v.sevenDays')
    .refine(
      d => d.every(x => x.isClosed || toMinutes(x.openTime) !== toMinutes(x.closeTime)),
      'v.closeDiffers'
    ),
})

/** POST /pitches/:id/exceptions — a day the pitch is closed. */
export const PitchExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'v.useIsoDate'),
  reason: z.preprocess(blankToUndefined, z.string().trim().max(200).optional()),
})

/** A day's hours as one span in minutes; past midnight runs on past 1440. */
function span(d: DayHours): [number, number] {
  const open = toMinutes(d.openTime)
  let close = toMinutes(d.closeTime)
  if (close <= open) close += 24 * 60
  return [open, close]
}

/**
 * Why a pitch's hours on a day don't fit inside the venue's, or null. A
 * pitch can be open less than its venue, never more (E10-10).
 */
export function pitchDayError(pitch: DayHours, venue: DayHours, locale: Locale): string | null {
  const t = sharedT(locale)
  if (pitch.isClosed) return null
  if (venue.isClosed) return t('pitchHours.venueClosed')
  const [po, pc] = span(pitch)
  const [vo, vc] = span(venue)
  if (po < vo) return t('pitchHours.opensBefore', { time: venue.openTime })
  if (pc > vc) return t('pitchHours.closesAfter', { time: venue.closeTime })
  return null
}

/** Where two lists of open intervals overlap (minutes in one day). */
export function intersectIntervals(
  a: [number, number][],
  b: [number, number][]
): [number, number][] {
  const out: [number, number][] = []
  for (const [a1, a2] of a) {
    for (const [b1, b2] of b) {
      const start = Math.max(a1, b1)
      const end = Math.min(a2, b2)
      if (start < end) out.push([start, end])
    }
  }
  return out.sort((x, y) => x[0] - y[0])
}

/** GET /manager/pitches — one row of the pitch list (E10-05). */
export interface ManagerPitchRow {
  id: string
  name: string
  surfaceType: SurfaceType
  size: PitchSize
  isActive: boolean
  minTrustScore: number
  coverPhotoUrl: string | null
  /** Null below three reviews, as players see it. */
  avgRating: number | null
  reviewCount: number
  bookingsToday: number
  upcomingBookings: number
  photoCount: number
  hourlyRate: number
}

/** What the editor loads for one pitch. */
export interface ManagerPitch {
  id: string
  name: string
  surfaceType: SurfaceType
  size: PitchSize
  widthMeters: number | null
  lengthMeters: number | null
  description: string | null
  isActive: boolean
  minTrustScore: number
  hourlyRate: number
  minBookingHours: number
  maxBookingHours: number
  advanceBookingDays: number
  hasShirts: boolean
  photos: { id: string; url: string; order: number }[]
  amenities: AmenityType[]
  shirtInventory: { colour: ShirtColour; quantity: number }[]
  /** The pitch's own hours; null when it follows the venue's. */
  workingHours: DayHours[] | null
  venueHours: DayHours[]
  exceptions: { id: string; date: string; reason: string | null }[]
  /** C-14: prices while covered, and the covered days. */
  coveredColdRate: number | null
  coveredHotRate: number | null
  coveredSeasons: { id: string; startDate: string; endDate: string }[]
}
