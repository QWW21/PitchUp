import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  companyListQueryString,
  hasActiveFilters,
  priceBound,
} from './discover-query'
import { CompanyListQuerySchema } from './schemas/discover'

const parse = (qs: string) => {
  const params = new URLSearchParams(qs)
  const raw: Record<string, unknown> = Object.fromEntries(params.entries())
  for (const key of ['surface', 'size', 'amenities']) raw[key] = params.getAll(key)
  return CompanyListQuerySchema.safeParse(raw)
}

describe('companyListQueryString', () => {
  it('sends only the city when nothing else is set', () => {
    expect(companyListQueryString({ city: 'Cluj-Napoca', filters: DEFAULT_FILTERS })).toBe(
      'city=Cluj-Napoca'
    )
  })

  it('encodes diacritics', () => {
    expect(companyListQueryString({ city: 'Iași', filters: DEFAULT_FILTERS })).toBe(
      'city=Ia%C8%99i'
    )
  })

  it('repeats keys instead of using array brackets', () => {
    const qs = companyListQueryString({
      city: 'Cluj-Napoca',
      filters: { ...DEFAULT_FILTERS, surfaces: ['FUTSAL', 'NATURAL_GRASS'] },
    })
    expect(qs).toBe('city=Cluj-Napoca&surface=FUTSAL&surface=NATURAL_GRASS')
    expect(qs).not.toContain('[]')
  })

  it('expands an amenity choice into its free and paid enum values', () => {
    const qs = companyListQueryString({
      city: 'Cluj-Napoca',
      filters: { ...DEFAULT_FILTERS, amenities: ['showers'] },
    })
    expect(qs).toBe('city=Cluj-Napoca&amenities=SHOWERS_FREE&amenities=SHOWERS_PAID')
  })

  it('trims an empty search away and includes coordinates and paging', () => {
    expect(
      companyListQueryString({
        city: 'Cluj-Napoca',
        search: '   ',
        sort: 'distance',
        coords: { lat: 46.77, lng: 23.59 },
        filters: { ...DEFAULT_FILTERS, priceMax: 200, availableNow: true },
        cursor: 'abc',
        limit: 5,
      })
    ).toBe(
      'city=Cluj-Napoca&sort=distance&lat=46.77&lng=23.59&priceMax=200&availableNow=true&cursor=abc&limit=5'
    )
  })

  it('produces something the API schema accepts', () => {
    const qs = companyListQueryString({
      city: 'Cluj-Napoca',
      search: 'arena',
      sort: 'price',
      filters: {
        surfaces: ['ARTIFICIAL_GRASS'],
        sizes: ['SIX_A_SIDE'],
        amenities: ['parking', 'lighting'],
        priceMin: 50,
        priceMax: 150,
        availableNow: true,
      },
    })
    const result = parse(qs)
    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({
      city: 'Cluj-Napoca',
      search: 'arena',
      amenities: ['PARKING_FREE', 'PARKING_PAID', 'NIGHT_LIGHTING'],
      priceMin: 50,
      size: ['SIX_A_SIDE'],
      availableNow: true,
      limit: 20,
    })
  })
})

describe('hasActiveFilters', () => {
  it('is false for the defaults and true for any change', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, availableNow: true })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, priceMin: 40 })).toBe(true)
  })
})

describe('priceBound', () => {
  it('treats the ends of the slider as no limit', () => {
    expect(priceBound(20, 'min')).toBeNull()
    expect(priceBound(500, 'max')).toBeNull()
    expect(priceBound(60, 'min')).toBe(60)
    expect(priceBound(300, 'max')).toBe(300)
  })
})

describe('CompanyListQuerySchema', () => {
  it('requires a city, with a readable message', () => {
    const r = parse('')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('City is required')
  })
  it('rejects an unknown city, a lone lat, a reversed price range and limit > 50', () => {
    expect(parse('city=Atlantis').success).toBe(false)
    expect(parse('city=Cluj-Napoca&lat=46.7').success).toBe(false)
    expect(parse('city=Cluj-Napoca&priceMin=200&priceMax=100').success).toBe(false)
    expect(parse('city=Cluj-Napoca&limit=51').success).toBe(false)
  })
  it('rejects booleans that are not true/false', () => {
    expect(parse('city=Cluj-Napoca&availableNow=yes').success).toBe(false)
  })
})
