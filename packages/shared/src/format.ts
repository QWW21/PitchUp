/**
 * Display rules shared by web and mobile — E04.
 */
import type { AmenityType } from './types'
import type { PeakHours } from './schemas/pitch'
import { DAY_SHORT } from './schedule'

/** Every amenity, in the order the pitch page lists them. E04-05. */
export const AMENITY_LABELS: Record<AmenityType, string> = {
  SHOWERS_FREE: 'Showers (free)',
  SHOWERS_PAID: 'Showers (paid)',
  CHANGING_ROOMS: 'Changing rooms',
  PARKING_FREE: 'Parking (free)',
  PARKING_PAID: 'Parking (paid)',
  NIGHT_LIGHTING: 'Night lighting',
  BALL_RENTAL_FREE: 'Ball rental (free)',
  BALL_RENTAL_PAID: 'Ball rental (paid)',
  REFRESHMENTS: 'Refreshments',
  LOCKERS: 'Lockers',
  REFEREE: 'Referee',
  FIRST_AID: 'First aid kit',
  WHEELCHAIR: 'Wheelchair access',
  WIFI: 'Wi-Fi',
}

export const ALL_AMENITIES = Object.keys(AMENITY_LABELS) as AmenityType[]

/**
 * Public name for a reviewer: first name and last initial ("Alexandru D."),
 * so a review never publishes someone's full name. PRD §11.
 */
export function playerDisplayName(fullName: string, isAnonymous: boolean): string {
  if (isAnonymous) return 'Anonymous player'
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first
}

/** Contiguous runs of days, Monday-first: [1,2,3,4,5] → "Mon–Fri", [0,6] → "Sat–Sun". */
function formatDays(days: number[]): string {
  if (days.length === 7) return 'Every day'
  // Monday-first order, so a weekend reads Sat–Sun rather than Sun, Sat.
  const order = [1, 2, 3, 4, 5, 6, 0]
  const sorted = order.filter(d => days.includes(d))
  const runs: number[][] = []
  for (const d of sorted) {
    const run = runs[runs.length - 1]
    const prev = run?.[run.length - 1]
    if (run && prev !== undefined && order.indexOf(d) === order.indexOf(prev) + 1) run.push(d)
    else runs.push([d])
  }
  return runs
    .map(r =>
      r.length > 2
        ? `${DAY_SHORT[r[0]!]}–${DAY_SHORT[r[r.length - 1]!]}`
        : r.map(d => DAY_SHORT[d]).join(', ')
    )
    .join(', ')
}

/**
 * "Mon–Fri 17:00–23:00 + Sat–Sun 07:00–23:00" from a pitch's peak windows.
 * An empty definition means every hour is off-peak. E04-05.
 */
export function formatPeakHours(peak: PeakHours): string | null {
  if (!peak.length) return null
  return peak.map(p => `${formatDays(p.days)} ${p.startTime}–${p.endTime}`).join(' + ')
}

/** "5v5 (25×45m)", or just "5v5" without dimensions. PRD §7.4. */
export function formatPitchSize(
  label: string,
  widthMeters: number | null,
  lengthMeters: number | null
): string {
  return widthMeters && lengthMeters ? `${label} (${widthMeters}×${lengthMeters}m)` : label
}
