/**
 * Romanian cities. Single source of truth — apps/web/prisma/seed.ts imports
 * this list, so the DB City table and the client-side pickers cannot drift.
 */
export interface City {
  readonly name: string
  readonly county: string
}

export const CITIES: readonly City[] = [
  { name: 'București', county: 'București' },
  { name: 'Cluj-Napoca', county: 'Cluj' },
  { name: 'Timișoara', county: 'Timiș' },
  { name: 'Iași', county: 'Iași' },
  { name: 'Constanța', county: 'Constanța' },
  { name: 'Craiova', county: 'Dolj' },
  { name: 'Brașov', county: 'Brașov' },
  { name: 'Galați', county: 'Galați' },
  { name: 'Ploiești', county: 'Prahova' },
  { name: 'Oradea', county: 'Bihor' },
] as const

export const CITY_NAMES: readonly string[] = CITIES.map(c => c.name)

export const DEFAULT_COUNTRY = 'RO'
