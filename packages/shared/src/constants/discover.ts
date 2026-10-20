import type { AmenityType, SurfaceType } from '../types'

/** Discover list and filters. PRD §7.2, UIUX_SPEC §5. */
export const DISCOVER = {
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 50,
  /** "Available now" means a pitch is free for this long from now. PRD §7.2. */
  AVAILABLE_NOW_WINDOW_HOURS: 2,
  /** Price filter bounds, RON per hour. UIUX_SPEC §5.4. */
  PRICE_MIN: 20,
  PRICE_MAX: 500,
  PRICE_STEP: 10,
  SEARCH_DEBOUNCE_MS: 300,
  /** Venues are in Romania; working hours are local wall-clock times. */
  TIME_ZONE: 'Europe/Bucharest',
} as const

export const COMPANY_SORTS = ['distance', 'rating', 'price', 'newest'] as const
export type CompanySort = (typeof COMPANY_SORTS)[number]

/** Surface chip colours. UIUX_SPEC §2.7. */
export const SURFACE_COLORS: Record<SurfaceType, { background: string; text: string }> = {
  NATURAL_GRASS: { background: '#F0FDF4', text: '#15803D' },
  ARTIFICIAL_GRASS: { background: '#EFF6FF', text: '#1D4ED8' },
  FUTSAL: { background: '#FEF3C7', text: '#92400E' },
}

/** CUSTOM is a pitch size but not something a player filters by. */
export const FILTERABLE_SIZES = [
  'FIVE_A_SIDE',
  'SIX_A_SIDE',
  'SEVEN_A_SIDE',
  'ELEVEN_A_SIDE',
] as const

/**
 * What the player picks in the amenity filter. Free and paid variants are one
 * choice — someone who wants showers does not care, at this stage, whether
 * they cost extra. The API receives the expanded enum values and requires
 * every selected group to be present on the same pitch.
 */
export const AMENITY_FILTERS: readonly { key: AmenityFilterKey; types: AmenityType[] }[] = [
  { key: 'showers', types: ['SHOWERS_FREE', 'SHOWERS_PAID'] },
  { key: 'changing', types: ['CHANGING_ROOMS'] },
  { key: 'parking', types: ['PARKING_FREE', 'PARKING_PAID'] },
  { key: 'lighting', types: ['NIGHT_LIGHTING'] },
  { key: 'ball', types: ['BALL_RENTAL_FREE', 'BALL_RENTAL_PAID'] },
  { key: 'refreshments', types: ['REFRESHMENTS'] },
  { key: 'lockers', types: ['LOCKERS'] },
  { key: 'referee', types: ['REFEREE'] },
  { key: 'firstAid', types: ['FIRST_AID'] },
  { key: 'wifi', types: ['WIFI'] },
  { key: 'wheelchair', types: ['WHEELCHAIR'] },
]

/** Named by `amenityFilter.<key>` in the catalogs. */
export type AmenityFilterKey =
  | 'showers'
  | 'changing'
  | 'parking'
  | 'lighting'
  | 'ball'
  | 'refreshments'
  | 'lockers'
  | 'referee'
  | 'firstAid'
  | 'wifi'
  | 'wheelchair'
