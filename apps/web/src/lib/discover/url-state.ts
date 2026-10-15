/**
 * Discover page state <-> URL search params — E03-08.
 *
 * The URL is the source of truth so a filtered view can be shared or
 * bookmarked. Coordinates are deliberately not in it: a shared link must not
 * carry the sender's location.
 */
import {
  AMENITY_FILTERS,
  CITY_NAMES,
  COMPANY_SORTS,
  FILTERABLE_SIZES,
  type CompanySort,
  type DiscoverFilters,
  type PitchSize,
  type SurfaceType,
} from '@pitchup/shared'

export type ViewMode = 'list' | 'map'

export interface DiscoverUrlState {
  city: string | null
  search: string
  sort: CompanySort | null
  view: ViewMode
  filters: DiscoverFilters
}

const SURFACES: SurfaceType[] = ['NATURAL_GRASS', 'ARTIFICIAL_GRASS', 'FUTSAL']
const AMENITY_KEYS = AMENITY_FILTERS.map(a => a.key)

const pick = <T extends string>(values: string[], allowed: readonly T[]): T[] =>
  values.filter((v): v is T => (allowed as readonly string[]).includes(v))

const num = (value: string | null): number | null => {
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Unknown or malformed values are dropped rather than sent on to the API. */
export function readUrlState(params: URLSearchParams): DiscoverUrlState {
  const city = params.get('city')
  const sort = params.get('sort')
  return {
    city: city && CITY_NAMES.includes(city) ? city : null,
    search: params.get('search') ?? '',
    sort:
      sort && (COMPANY_SORTS as readonly string[]).includes(sort) ? (sort as CompanySort) : null,
    view: params.get('view') === 'map' ? 'map' : 'list',
    filters: {
      surfaces: pick(params.getAll('surface'), SURFACES),
      sizes: pick(params.getAll('size'), FILTERABLE_SIZES as readonly PitchSize[]),
      amenities: pick(params.getAll('amenity'), AMENITY_KEYS),
      priceMin: num(params.get('priceMin')),
      priceMax: num(params.get('priceMax')),
      availableNow: params.get('availableNow') === 'true',
    },
  }
}

export function writeUrlState(state: DiscoverUrlState): string {
  const params = new URLSearchParams()
  if (state.city) params.set('city', state.city)
  if (state.search.trim()) params.set('search', state.search.trim())
  if (state.sort) params.set('sort', state.sort)
  if (state.view === 'map') params.set('view', 'map')
  const f = state.filters
  f.surfaces.forEach(s => params.append('surface', s))
  f.sizes.forEach(s => params.append('size', s))
  f.amenities.forEach(a => params.append('amenity', a))
  if (f.priceMin !== null) params.set('priceMin', String(f.priceMin))
  if (f.priceMax !== null) params.set('priceMax', String(f.priceMax))
  if (f.availableNow) params.set('availableNow', 'true')
  return params.toString()
}
