import { CITIES, type City } from './constants/cities'

/** Great-circle distance in km. Accurate to well under 1% at city scale. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** How far from a city centre a position still counts as that city. */
export const NEAREST_CITY_MAX_KM = 40

/**
 * Maps a GPS position to the closest supported city, or null when none is
 * within NEAREST_CITY_MAX_KM. Used in place of a reverse-geocoding call:
 * the answer has to be one of CITIES anyway, it works offline and needs no
 * API key, and a suburb such as Florești resolves to Cluj-Napoca rather than
 * to a locality name that matches nothing.
 */
export function nearestCity(lat: number, lng: number): City | null {
  let best: City | null = null
  let bestKm = Infinity
  for (const city of CITIES) {
    const km = haversineKm(lat, lng, city.lat, city.lng)
    if (km < bestKm) {
      best = city
      bestKm = km
    }
  }
  return bestKm <= NEAREST_CITY_MAX_KM ? best : null
}

/** U+0300–U+036F: the accents NFD splits off a letter (ș → s + comma below). */
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  'g'
)

/** Lower-cased with diacritics removed, so "timis" matches "Timișoara". */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}
