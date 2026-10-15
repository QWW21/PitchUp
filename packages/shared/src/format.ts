/**
 * Display rules shared by web and mobile — E04.
 */
import type { AmenityType } from './types'

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

/**
 * A rough 0–4 strength for the password meter (web E02, mobile E08). Feedback,
 * not a gate: the rules themselves are passwordSchema.
 */
export function scorePassword(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1
  return Math.min(score, 4)
}

/** "5v5 (25×45m)", or just "5v5" without dimensions. PRD §7.4. */
export function formatPitchSize(
  label: string,
  widthMeters: number | null,
  lengthMeters: number | null
): string {
  return widthMeters && lengthMeters ? `${label} (${widthMeters}×${lengthMeters}m)` : label
}

/** "blue, red and yellow" from a pitch's shirt inventory; "" when it has none. */
export function formatShirtColours(inventory: { colour: string; quantity: number }[]): string {
  const names = inventory.filter(s => s.quantity > 0).map(s => s.colour.toLowerCase())
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : (names[0] ?? '')
}
