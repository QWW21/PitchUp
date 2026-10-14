import { describe, expect, it } from 'vitest'
import { companyRating, publicRating, round1 } from './ratings'

describe('publicRating (PRD §11.2)', () => {
  it('hides a rating below three reviews', () => {
    expect(publicRating(5, 2)).toBeNull()
    expect(publicRating(null, 10)).toBeNull()
  })
  it('shows it rounded to one decimal from three', () => {
    expect(publicRating(4.3333, 3)).toBe(4.3)
    expect(publicRating(4.25, 10)).toBe(4.3)
  })
})

describe('companyRating', () => {
  it('averages the pitches’ means, not the pooled reviews', () => {
    // Pooled would be (5*10 + 3*2) / 12 = 4.67; mean of means is 4.0.
    expect(
      companyRating([
        { mean: 5, count: 10 },
        { mean: 3, count: 2 },
      ])
    ).toEqual({
      avgRating: 4,
      reviewCount: 12,
    })
  })
  it('counts every review toward the threshold', () => {
    expect(
      companyRating([
        { mean: 5, count: 1 },
        { mean: 4, count: 1 },
      ])
    ).toEqual({
      avgRating: null,
      reviewCount: 2,
    })
  })
  it('handles a company with no reviews', () => {
    expect(companyRating([])).toEqual({ avgRating: null, reviewCount: 0 })
  })
  it('rounds half away from zero at one decimal', () => {
    expect(round1(4.45)).toBe(4.5)
  })
})
