import { AMENITY_FILTERS, DISCOVER, type CompanySort } from './constants/discover'
import type { PitchSize, SurfaceType } from './types'

/** The Discover filter panel's state, identical on web and mobile. E03-06, E03-08. */
export interface DiscoverFilters {
  surfaces: SurfaceType[]
  sizes: PitchSize[]
  /** AMENITY_FILTERS keys, not enum values: one choice covers free and paid. */
  amenities: string[]
  /** Null means the slider is at its bound, i.e. no limit. */
  priceMin: number | null
  priceMax: number | null
  /**
   * Open and with a free pitch now. There is no separate "open now" filter:
   * an open venue with every pitch booked has nothing to offer, so it would
   * only add results a player cannot use. The card still shows "Open".
   */
  availableNow: boolean
}

export const DEFAULT_FILTERS: DiscoverFilters = {
  surfaces: [],
  sizes: [],
  amenities: [],
  priceMin: null,
  priceMax: null,
  availableNow: false,
}

export function hasActiveFilters(f: DiscoverFilters): boolean {
  return (
    f.surfaces.length > 0 ||
    f.sizes.length > 0 ||
    f.amenities.length > 0 ||
    f.priceMin !== null ||
    f.priceMax !== null ||
    f.availableNow
  )
}

/** A slider value at the end of its track means "no limit on this side". */
export function priceBound(value: number, side: 'min' | 'max'): number | null {
  if (side === 'min') return value <= DISCOVER.PRICE_MIN ? null : value
  return value >= DISCOVER.PRICE_MAX ? null : value
}

export interface CompanyListRequest {
  city: string
  search?: string | undefined
  sort?: CompanySort | undefined
  coords?: { lat: number; lng: number } | null | undefined
  filters: DiscoverFilters
  cursor?: string | null | undefined
  limit?: number | undefined
}

/**
 * Builds the GET /companies query string. Done by hand rather than with
 * URLSearchParams, which React Native implements only partially, and so that
 * repeated keys come out as `surface=A&surface=B` — the form the API parses —
 * rather than axios's default `surface[]=A`.
 */
export function companyListQueryString(r: CompanyListRequest): string {
  const pairs: [string, string | number | boolean][] = [['city', r.city]]
  const search = r.search?.trim()
  if (search) pairs.push(['search', search])
  if (r.sort) pairs.push(['sort', r.sort])
  if (r.coords) pairs.push(['lat', r.coords.lat], ['lng', r.coords.lng])

  for (const s of r.filters.surfaces) pairs.push(['surface', s])
  for (const s of r.filters.sizes) pairs.push(['size', s])
  for (const key of r.filters.amenities) {
    for (const type of AMENITY_FILTERS.find(a => a.key === key)?.types ?? []) {
      pairs.push(['amenities', type])
    }
  }
  if (r.filters.priceMin !== null) pairs.push(['priceMin', r.filters.priceMin])
  if (r.filters.priceMax !== null) pairs.push(['priceMax', r.filters.priceMax])
  if (r.filters.availableNow) pairs.push(['availableNow', true])
  if (r.cursor) pairs.push(['cursor', r.cursor])
  if (r.limit) pairs.push(['limit', r.limit])

  return pairs.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
}
