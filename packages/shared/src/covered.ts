/**
 * Covered season — C-14. In winter a venue may cover a pitch (a dome) and
 * offer cold air, hot air or both, each at its own full hourly price. The
 * booking's date (the venue's calendar day of the start) decides the price;
 * outside every season the pitch's one all-year rate applies.
 */
import { z } from 'zod'

export const AIR_TYPES = ['COLD', 'HOT'] as const
export type AirType = (typeof AIR_TYPES)[number]

/** The longest season a venue can enter at once, in days. */
export const MAX_SEASON_DAYS = 200

export interface CoveredSeason {
  /** YYYY-MM-DD, inclusive. */
  startDate: string
  endDate: string
}

export interface CoveredPricing {
  /** Uncovered, all year. */
  hourlyRate: number
  coveredColdRate: number | null
  coveredHotRate: number | null
  seasons: CoveredSeason[]
}

/** Is the pitch covered on this venue date? */
export function isCoveredOn(p: CoveredPricing, date: string): boolean {
  return p.seasons.some(s => s.startDate <= date && date <= s.endDate)
}

/** The air types on offer that day: [] uncovered; ['COLD'], ['HOT'] or ['COLD','HOT']. */
export function airOptionsOn(p: CoveredPricing, date: string): AirType[] {
  if (!isCoveredOn(p, date)) return []
  const options: AirType[] = []
  if (p.coveredColdRate !== null) options.push('COLD')
  if (p.coveredHotRate !== null) options.push('HOT')
  return options
}

/**
 * The hourly rate for a date and choice. Cold by default when both are
 * offered; the only one when one is. Null when `air` is not offered that day.
 */
export function rateFor(
  p: CoveredPricing,
  date: string,
  air?: AirType | null
): { rate: number; airType: AirType | null } | null {
  const options = airOptionsOn(p, date)
  if (!options.length) return air ? null : { rate: p.hourlyRate, airType: null }
  const airType = air ?? options[0]!
  if (!options.includes(airType)) return null
  return { rate: (airType === 'COLD' ? p.coveredColdRate : p.coveredHotRate)!, airType }
}

/** Days from one YYYY-MM-DD to another, inclusive of both. */
export function seasonDays(s: CoveredSeason): number {
  const ms = Date.parse(`${s.endDate}T00:00:00Z`) - Date.parse(`${s.startDate}T00:00:00Z`)
  return Math.round(ms / 86_400_000) + 1
}

/** Two seasons share at least one day. */
export const seasonsOverlap = (a: CoveredSeason, b: CoveredSeason): boolean =>
  a.startDate <= b.endDate && b.startDate <= a.endDate

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'v.useIsoDate')
  .refine(d => {
    const t = new Date(`${d}T00:00:00Z`)
    return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(d)
  }, 'v.validDate')

/** POST /pitches/:id/covered-seasons. The API also refuses past starts and overlaps. */
export const CoveredSeasonSchema = z
  .object({ startDate: isoDate, endDate: isoDate })
  .refine(s => s.startDate <= s.endDate, { message: 'v.startAfterEnd', path: ['endDate'] })
  .refine(s => s.startDate > s.endDate || seasonDays(s) <= MAX_SEASON_DAYS, {
    message: 'v.seasonTooLong',
    path: ['endDate'],
  })

export type CoveredSeasonInput = z.infer<typeof CoveredSeasonSchema>
