import { describe, expect, it } from 'vitest'
import { foldForSearch, haversineKm, nearestCity, NEAREST_CITY_MAX_KM } from './geo'

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(46.77, 23.59, 46.77, 23.59)).toBe(0)
  })
  it('matches the known Cluj-Napoca – București distance (~324 km)', () => {
    expect(haversineKm(46.7712, 23.6236, 44.4268, 26.1025)).toBeCloseTo(324, -1)
  })
  it('is symmetric', () => {
    expect(haversineKm(1, 2, 3, 4)).toBeCloseTo(haversineKm(3, 4, 1, 2), 10)
  })
})

describe('nearestCity', () => {
  it('snaps a suburb to its city (Florești → Cluj-Napoca)', () => {
    expect(nearestCity(46.7476, 23.4904)?.name).toBe('Cluj-Napoca')
  })
  it('finds the city for a central position', () => {
    expect(nearestCity(44.43, 26.1)?.name).toBe('București')
    expect(nearestCity(45.75, 21.23)?.name).toBe('Timișoara')
  })
  it('returns null far from every supported city', () => {
    expect(nearestCity(48.2082, 16.3738)).toBeNull() // Vienna
  })
  it(`gives up beyond ${NEAREST_CITY_MAX_KM} km`, () => {
    // ~0.5° of latitude ≈ 55 km north of Oradea, with no other city nearby.
    expect(nearestCity(47.55, 21.92)).toBeNull()
  })
})

describe('foldForSearch', () => {
  it('strips Romanian diacritics and lower-cases', () => {
    expect(foldForSearch('Timișoara Brașov Iași Constanța')).toBe('timisoara brasov iasi constanta')
  })
  it('lets "timis" match "Timișoara"', () => {
    expect(foldForSearch('Timișoara').includes(foldForSearch('timis'))).toBe(true)
  })
  it('handles the cedilla variants (ş ţ) as well as comma-below (ș ț)', () => {
    expect(foldForSearch('Timişoara')).toBe('timisoara')
  })
})
