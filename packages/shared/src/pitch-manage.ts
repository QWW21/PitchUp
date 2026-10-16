/**
 * Managing pitches — E10 (with C-1, C-2 and C-3). The schemas the manager's
 * pitch editor and the API share, and the rules both apply.
 */
import { z } from 'zod'
import { SHIRT_COLOURS } from './constants/shirts'
import { toMinutes, type DayHours } from './schedule'
import type { AmenityType, PitchSize, ShirtColour, SurfaceType } from './types'

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
const metres = z.number().positive('Enter a size in metres').max(200, 'At most 200 m')

const basicFields = {
  name: z
    .string()
    .trim()
    .min(2, 'Enter a name')
    .max(PITCH_LIMITS.NAME_MAX, `At most ${PITCH_LIMITS.NAME_MAX} characters`),
  surfaceType,
  size,
  widthMeters: metres.optional(),
  lengthMeters: metres.optional(),
  description: z.preprocess(
    blankToUndefined,
    z.string().trim().max(PITCH_LIMITS.DESCRIPTION_MAX).optional()
  ),
}

const customNeedsSize = (d: {
  size?: string | undefined
  widthMeters?: number | undefined
  lengthMeters?: number | undefined
}) => d.size !== 'CUSTOM' || (!!d.widthMeters && !!d.lengthMeters)

/** POST /pitches and the Basic info tab — E10-01. A new pitch starts inactive. */
export const PitchBasicInfoSchema = z.object(basicFields).refine(customNeedsSize, {
  message: 'A custom size needs its width and length',
  path: ['widthMeters'],
})

/** PUT /pitches/:id — only the fields sent change. */
export const UpdatePitchBasicInfoSchema = z
  .object(basicFields)
  .partial()
  .refine(d => Object.keys(d).length > 0, { message: 'Nothing to change' })

export const PitchStatusSchema = z.object({ isActive: z.boolean() })

/** POST /pitches/:id/photos — the image is already on Cloudinary. */
export const AddPitchPhotoSchema = z.object({
  url: z
    .string()
    .url()
    .refine(u => u.startsWith('https://res.cloudinary.com/'), 'Upload the photo through PitchUp'),
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
    .refine(a => new Set(a).size === a.length, 'Each amenity once'),
})

const oneOf = <T extends readonly number[]>(values: T, message: string) =>
  z.number().refine(v => (values as readonly number[]).includes(v), message)

/** PUT /pitches/:id/pricing — one hourly rate (C-2) and the booking limits. */
export const PitchPricingSchema = z
  .object({
    hourlyRate: z
      .number({ invalid_type_error: 'Enter a price' })
      .positive('Enter a price above 0')
      .max(9999, 'At most 9999 RON'),
    minBookingHours: oneOf(PRICING_OPTIONS.MIN_BOOKING_HOURS, 'Choose 1h, 1h 30 or 2h'),
    maxBookingHours: oneOf(PRICING_OPTIONS.MAX_BOOKING_HOURS, 'Choose between 2h and 4h'),
    advanceBookingDays: oneOf(PRICING_OPTIONS.ADVANCE_BOOKING_DAYS, 'Choose 30, 60 or 90 days'),
  })
  .refine(d => d.minBookingHours <= d.maxBookingHours, {
    message: 'The shortest booking cannot be longer than the longest',
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
      .refine(i => new Set(i.map(c => c.colour)).size === i.length, 'Each colour once')
      .default([]),
    /** Save even though upcoming bookings were promised more sets than this. */
    force: z.boolean().optional(),
  })
  .refine(d => !d.hasShirts || d.inventory.some(c => c.quantity > 0), {
    message: 'Add at least one set, or stop lending shirts',
    path: ['inventory'],
  })

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')

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
    .length(7, 'Give hours for all seven days')
    .refine(d => new Set(d.map(x => x.day)).size === 7, 'Give hours for all seven days')
    .refine(
      d => d.every(x => x.isClosed || toMinutes(x.openTime) !== toMinutes(x.closeTime)),
      'Closing time must differ from opening time'
    ),
})

/** POST /pitches/:id/exceptions — a day the pitch is closed. */
export const PitchExceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
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
export function pitchDayError(pitch: DayHours, venue: DayHours): string | null {
  if (pitch.isClosed) return null
  if (venue.isClosed) return 'The venue is closed on this day'
  const [po, pc] = span(pitch)
  const [vo, vc] = span(venue)
  if (po < vo) return `Opens before the venue (${venue.openTime})`
  if (pc > vc) return `Closes after the venue (${venue.closeTime})`
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
}
