/**
 * Display rules shared by web and mobile — E04.
 */
import type { AmenityType } from './types'
import { en } from './i18n/en'
import { sharedT } from './i18n'
import type { Locale } from './i18n/core'

/** Every amenity, in the order the pitch page lists them (E04-05). Named by `amenity.<TYPE>`. */
export const ALL_AMENITIES = Object.keys(en.amenity) as AmenityType[]

/**
 * Public name for a reviewer: first name and last initial ("Alexandru D."),
 * so a review never publishes someone's full name. PRD §11.
 */
export function playerDisplayName(fullName: string, isAnonymous: boolean, locale: Locale): string {
  if (isAnonymous) return sharedT(locale)('player.anonymous')
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
  lengthMeters: number | null,
  locale: Locale
): string {
  return widthMeters && lengthMeters
    ? sharedT(locale)('size.withDimensions', { label, width: widthMeters, length: lengthMeters })
    : label
}

/** "blue, red and yellow" from a pitch's shirt inventory; "" when it has none. */
export function formatShirtColours(
  inventory: { colour: string; quantity: number }[],
  locale: Locale
): string {
  const t = sharedT(locale)
  const names = inventory
    .filter(s => s.quantity > 0)
    .map(s =>
      t.has(`shirt.${s.colour}`) ? t(`shirt.${s.colour}` as 'shirt.RED') : s.colour.toLowerCase()
    )
  return names.length > 1
    ? t('list.and', { items: names.slice(0, -1).join(', '), last: names.at(-1)! })
    : (names[0] ?? '')
}
