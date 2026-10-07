import { z } from 'zod'
import { BOOKING } from '../constants/booking'
import { SHIRT_COLOURS } from '../constants/shirts'
import { idSchema } from './common'

const surfaceTypeSchema = z.enum(['NATURAL_GRASS', 'ARTIFICIAL_GRASS', 'FUTSAL'])

const pitchSizeSchema = z.enum(['FIVE_A_SIDE', 'SEVEN_A_SIDE', 'ELEVEN_A_SIDE', 'CUSTOM'])

const amenityTypeSchema = z.enum([
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

const shirtColourSchema = z.enum(SHIRT_COLOURS as unknown as [string, ...string[]])

/** A peak-hours window. Times are the venue's local wall clock. */
const peakHoursEntrySchema = z
  .object({
    /** 0 = Sunday … 6 = Saturday. */
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:MM'),
  })
  .refine(entry => entry.startTime < entry.endTime, {
    message: 'Peak window must start before it ends',
    path: ['endTime'],
  })

export const PeakHoursSchema = z.array(peakHoursEntrySchema)

const priceSchema = z.number().nonnegative().max(100000)

export const CreatePitchSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000).optional(),
    surfaceType: surfaceTypeSchema,
    size: pitchSizeSchema,
    widthMeters: z.number().positive().max(200).optional(),
    lengthMeters: z.number().positive().max(200).optional(),
    isActive: z.boolean().default(true),
    coverPhotoIndex: z.number().int().min(0).default(0),
    minBookingHours: z
      .number()
      .int()
      .min(BOOKING.MIN_DURATION_HOURS)
      .max(BOOKING.MAX_DURATION_HOURS)
      .default(BOOKING.MIN_DURATION_HOURS),
    maxBookingHours: z
      .number()
      .int()
      .min(BOOKING.MIN_DURATION_HOURS)
      .max(BOOKING.MAX_DURATION_HOURS)
      .default(BOOKING.MAX_DURATION_HOURS),
    advanceBookingDays: z.number().int().min(1).max(365).default(BOOKING.MAX_ADVANCE_DAYS_DEFAULT),
    offPeakRate: priceSchema,
    peakRate: priceSchema,
    peakHoursDefinition: PeakHoursSchema.optional(),
    hasShirts: z.boolean().default(false),
    shirtRentalPrice: priceSchema.optional(),
  })
  .refine(data => data.minBookingHours <= data.maxBookingHours, {
    message: 'Minimum booking hours cannot exceed maximum',
    path: ['minBookingHours'],
  })
  .refine(data => !data.hasShirts || data.shirtRentalPrice !== undefined, {
    message: 'Shirt rental price is required when the pitch offers shirts',
    path: ['shirtRentalPrice'],
  })

/**
 * Partial update. Built from the inner object rather than CreatePitchSchema
 * because .partial() is not available on a ZodEffects (a refined schema).
 * Cross-field rules are re-checked in the API against the merged record.
 */
export const UpdatePitchSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000),
    surfaceType: surfaceTypeSchema,
    size: pitchSizeSchema,
    widthMeters: z.number().positive().max(200),
    lengthMeters: z.number().positive().max(200),
    isActive: z.boolean(),
    coverPhotoIndex: z.number().int().min(0),
    minBookingHours: z
      .number()
      .int()
      .min(BOOKING.MIN_DURATION_HOURS)
      .max(BOOKING.MAX_DURATION_HOURS),
    maxBookingHours: z
      .number()
      .int()
      .min(BOOKING.MIN_DURATION_HOURS)
      .max(BOOKING.MAX_DURATION_HOURS),
    advanceBookingDays: z.number().int().min(1).max(365),
    offPeakRate: priceSchema,
    peakRate: priceSchema,
    peakHoursDefinition: PeakHoursSchema,
    hasShirts: z.boolean(),
    shirtRentalPrice: priceSchema,
  })
  .partial()
  .refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const PitchAmenitySchema = z
  .object({
    amenityType: amenityTypeSchema,
    isPaid: z.boolean().default(false),
    price: priceSchema.optional(),
  })
  .refine(data => !data.isPaid || data.price !== undefined, {
    message: 'Price is required for a paid amenity',
    path: ['price'],
  })

export const ShirtInventorySchema = z.object({
  colour: shirtColourSchema,
  quantity: z.number().int().min(0).max(1000),
})

export const PitchPhotoSchema = z.object({
  url: z.string().url(),
  cloudinaryPublicId: z.string().min(1),
  order: z.number().int().min(0).default(0),
})

export const PitchIdSchema = z.object({ pitchId: idSchema })

export type CreatePitchInput = z.infer<typeof CreatePitchSchema>
export type UpdatePitchInput = z.infer<typeof UpdatePitchSchema>
export type PitchAmenityInput = z.infer<typeof PitchAmenitySchema>
export type ShirtInventoryInput = z.infer<typeof ShirtInventorySchema>
export type PitchPhotoInput = z.infer<typeof PitchPhotoSchema>
export type PeakHours = z.infer<typeof PeakHoursSchema>
