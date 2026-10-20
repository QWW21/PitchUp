import { z } from 'zod'
import { COMPANY_SORTS, DISCOVER } from '../constants/discover'
import { CITY_NAMES } from '../constants/cities'

const surfaceTypeSchema = z.enum(['NATURAL_GRASS', 'ARTIFICIAL_GRASS', 'FUTSAL'])
const pitchSizeSchema = z.enum([
  'FIVE_A_SIDE',
  'SIX_A_SIDE',
  'SEVEN_A_SIDE',
  'ELEVEN_A_SIDE',
  'CUSTOM',
])
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

/** Query strings carry "true"/"false"; anything else is a mistake worth a 400. */
const queryBoolean = z
  .enum(['true', 'false'])
  .optional()
  .transform(value => value === 'true')

/**
 * GET /api/v1/companies — E03-01.
 *
 * Multi-value parameters (`surface`, `size`, `amenities`) arrive as repeated
 * keys, so the caller must collect them into arrays before parsing.
 */
export const CompanyListQuerySchema = z
  .object({
    city: z
      .string({ required_error: 'v.cityRequired' })
      .trim()
      .min(1, 'v.cityRequired')
      .refine(city => CITY_NAMES.includes(city), 'Unknown city'),
    search: z.string().trim().max(100).optional(),
    sort: z.enum(COMPANY_SORTS).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    surface: z.array(surfaceTypeSchema).default([]),
    size: z.array(pitchSizeSchema).default([]),
    amenities: z.array(amenityTypeSchema).default([]),
    priceMin: z.coerce.number().nonnegative().optional(),
    priceMax: z.coerce.number().nonnegative().optional(),
    availableNow: queryBoolean,
    cursor: z.string().min(1).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(DISCOVER.PAGE_SIZE_MAX)
      .default(DISCOVER.PAGE_SIZE_DEFAULT),
  })
  .refine(q => (q.lat === undefined) === (q.lng === undefined), {
    message: 'lat and lng must be given together',
    path: ['lat'],
  })
  .refine(q => q.priceMin === undefined || q.priceMax === undefined || q.priceMin <= q.priceMax, {
    message: 'priceMin cannot exceed priceMax',
    path: ['priceMin'],
  })

export type CompanyListQuery = z.infer<typeof CompanyListQuerySchema>

/** One card in the Discover list or map. */
export interface CompanyListItem {
  id: string
  name: string
  logoUrl: string | null
  city: string
  address: string
  lat: number | null
  lng: number | null
  /** Null until the company has REVIEW.MIN_FOR_PUBLIC_RATING reviews. PRD §11.2. */
  avgRating: number | null
  reviewCount: number
  pitchCount: number
  /** Lowest hourly rate across active pitches, RON. */
  priceFrom: number
  isOpenNow: boolean
  /** Null when the request carried no lat/lng. */
  distanceKm: number | null
  isVerified: boolean
}

export interface CompanyListPage {
  companies: CompanyListItem[]
  nextCursor: string | null
  total: number
}
