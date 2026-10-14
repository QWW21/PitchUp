/**
 * Romanian cities. Single source of truth — apps/web/prisma/seed.ts imports
 * this list, so the DB City table and the client-side pickers cannot drift.
 *
 * `lat`/`lng` is the city centre: where the Discover map opens when the user
 * has not shared their location, and what GPS detection snaps to (E03-02).
 */
export interface City {
  readonly name: string
  readonly county: string
  readonly lat: number
  readonly lng: number
}

export const CITIES: readonly City[] = [
  { name: 'București', county: 'București', lat: 44.4268, lng: 26.1025 },
  { name: 'Cluj-Napoca', county: 'Cluj', lat: 46.7712, lng: 23.6236 },
  { name: 'Timișoara', county: 'Timiș', lat: 45.7489, lng: 21.2087 },
  { name: 'Iași', county: 'Iași', lat: 47.1585, lng: 27.6014 },
  { name: 'Constanța', county: 'Constanța', lat: 44.1598, lng: 28.6348 },
  { name: 'Craiova', county: 'Dolj', lat: 44.3302, lng: 23.7949 },
  { name: 'Brașov', county: 'Brașov', lat: 45.6427, lng: 25.5887 },
  { name: 'Galați', county: 'Galați', lat: 45.4353, lng: 28.008 },
  { name: 'Ploiești', county: 'Prahova', lat: 44.9462, lng: 26.0254 },
  { name: 'Oradea', county: 'Bihor', lat: 47.0465, lng: 21.9189 },
] as const

export const CITY_NAMES: readonly string[] = CITIES.map(c => c.name)

export const DEFAULT_COUNTRY = 'RO'
