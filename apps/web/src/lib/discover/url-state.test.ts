import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS } from '@pitchup/shared'
import { readUrlState, writeUrlState } from './url-state'

const read = (qs: string) => readUrlState(new URLSearchParams(qs))

describe('readUrlState', () => {
  it('reads every field', () => {
    expect(
      read(
        'city=Cluj-Napoca&search=arena&sort=price&view=map&surface=FUTSAL&size=SIX_A_SIDE&amenity=showers&priceMin=40&priceMax=200&availableNow=true'
      )
    ).toEqual({
      city: 'Cluj-Napoca',
      search: 'arena',
      sort: 'price',
      view: 'map',
      filters: {
        surfaces: ['FUTSAL'],
        sizes: ['SIX_A_SIDE'],
        amenities: ['showers'],
        priceMin: 40,
        priceMax: 200,
        availableNow: true,
      },
    })
  })

  it('drops values that are not allowed rather than passing them to the API', () => {
    const s = read(
      'city=Atlantis&sort=cheapest&surface=LAVA&size=CUSTOM&amenity=pool&priceMin=abc&view=3d'
    )
    expect(s.city).toBeNull()
    expect(s.sort).toBeNull()
    expect(s.view).toBe('list')
    expect(s.filters).toEqual(DEFAULT_FILTERS)
  })
})

describe('writeUrlState', () => {
  it('round-trips through readUrlState', () => {
    const state = read(
      'city=Ia%C8%99i&sort=rating&surface=NATURAL_GRASS&surface=FUTSAL&amenity=wifi&priceMax=150'
    )
    expect(read(writeUrlState(state))).toEqual(state)
  })

  it('writes nothing for defaults, and never coordinates', () => {
    expect(
      writeUrlState({
        city: null,
        search: '  ',
        sort: null,
        view: 'list',
        filters: DEFAULT_FILTERS,
      })
    ).toBe('')
  })
})
