import type { AmenityType, PitchSize, SurfaceType } from '../types'

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

export const SORT_LABELS: Record<CompanySort, string> = {
  distance: 'Nearest',
  rating: 'Top rated',
  price: 'Lowest price',
  newest: 'Newest',
}

export const SURFACE_LABELS: Record<SurfaceType, string> = {
  NATURAL_GRASS: 'Natural grass',
  ARTIFICIAL_GRASS: 'Artificial',
  FUTSAL: 'Futsal',
}

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

export const SIZE_LABELS: Record<PitchSize, string> = {
  FIVE_A_SIDE: '5v5',
  SIX_A_SIDE: '6v6',
  SEVEN_A_SIDE: '7v7',
  ELEVEN_A_SIDE: '11v11',
  CUSTOM: 'Custom',
}

/**
 * Shown beside a pitch size wherever a player sees one. The size is the
 * owner's recommendation, not a limit: the price is per hour, however many
 * players come.
 */
export const SIZE_INFO =
  'The number of players per team the owner recommends for the best game. It is not a limit: the price is the same however many of you come.'

/**
 * What the player picks in the amenity filter. Free and paid variants are one
 * choice — someone who wants showers does not care, at this stage, whether
 * they cost extra. The API receives the expanded enum values and requires
 * every selected group to be present on the same pitch.
 */
export const AMENITY_FILTERS: readonly { key: string; label: string; types: AmenityType[] }[] = [
  { key: 'showers', label: 'Showers', types: ['SHOWERS_FREE', 'SHOWERS_PAID'] },
  { key: 'changing', label: 'Changing rooms', types: ['CHANGING_ROOMS'] },
  { key: 'parking', label: 'Parking', types: ['PARKING_FREE', 'PARKING_PAID'] },
  { key: 'lighting', label: 'Night lighting', types: ['NIGHT_LIGHTING'] },
  { key: 'ball', label: 'Ball rental', types: ['BALL_RENTAL_FREE', 'BALL_RENTAL_PAID'] },
  { key: 'refreshments', label: 'Refreshments', types: ['REFRESHMENTS'] },
  { key: 'lockers', label: 'Lockers', types: ['LOCKERS'] },
  { key: 'referee', label: 'Referee', types: ['REFEREE'] },
  { key: 'firstAid', label: 'First aid', types: ['FIRST_AID'] },
  { key: 'wifi', label: 'Wi-Fi', types: ['WIFI'] },
  { key: 'wheelchair', label: 'Wheelchair', types: ['WHEELCHAIR'] },
]
