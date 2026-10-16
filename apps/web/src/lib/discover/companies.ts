/**
 * Discover company list — E03-01.
 *
 * Filtering that the database can do (city, status, name search, pitch
 * attributes) happens in one query. Everything derived — rating, price,
 * distance, open now — is computed in memory, and so is sorting and paging,
 * because three of the four sort keys are derived values the database does
 * not hold.
 *
 * That means each request reads every matching company in the city. It is
 * four queries regardless of result size, which is fine at v1.0 scale (a few
 * hundred venues per city at most). Past that, denormalise rating and price
 * onto Company and move distance to PostGIS so sorting can go back to SQL.
 */
import 'server-only'
import type { AmenityType, Prisma } from '@prisma/client'
import {
  AMENITY_FILTERS,
  DISCOVER,
  haversineKm,
  type CompanyListItem,
  type CompanyListPage,
  type CompanyListQuery,
  type CompanySort,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { validationError } from '@/lib/api/errors'
import { companyRating, pitchStats, round1, type PitchStats } from '@/lib/venues/ratings'
import { liveBookingWhere } from '@/lib/bookings/live'
import { isOpenAt } from './opening-hours'

/**
 * Pitch conditions, all of which one pitch must satisfy. A company with a
 * futsal pitch and a separate pitch with showers does not match
 * "futsal + showers": the player wants to play on the pitch with showers.
 */
function pitchWhere(q: CompanyListQuery): Prisma.PitchWhereInput {
  // Amenity values are OR-ed within their filter group (free or paid
  // showers) and AND-ed across groups (showers and parking).
  const groups = new Map<string, AmenityType[]>()
  for (const type of q.amenities) {
    const group = AMENITY_FILTERS.find(f => f.types.includes(type))?.key ?? type
    groups.set(group, [...(groups.get(group) ?? []), type])
  }

  return {
    isActive: true,
    ...(q.surface.length ? { surfaceType: { in: q.surface } } : {}),
    ...(q.size.length ? { size: { in: q.size } } : {}),
    ...(q.priceMin !== undefined || q.priceMax !== undefined
      ? {
          hourlyRate: {
            ...(q.priceMin !== undefined ? { gte: q.priceMin } : {}),
            ...(q.priceMax !== undefined ? { lte: q.priceMax } : {}),
          },
        }
      : {}),
    ...(groups.size
      ? {
          AND: [...groups.values()].map(types => ({
            amenities: { some: { amenityType: { in: types } } },
          })),
        }
      : {}),
  }
}

/** Ascending, with nulls after every real value whichever way the key runs. */
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (a - b) * direction
}

type Row = CompanyListItem & { createdAt: Date }

const COMPARATORS: Record<CompanySort, (a: Row, b: Row) => number> = {
  distance: (a, b) => compareNullable(a.distanceKm, b.distanceKm, 1),
  rating: (a, b) => compareNullable(a.avgRating, b.avgRating, -1) || b.reviewCount - a.reviewCount,
  price: (a, b) => a.priceFrom - b.priceFrom,
  newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
}

export async function listCompanies(
  q: CompanyListQuery,
  now: Date = new Date()
): Promise<CompanyListPage> {
  const matchingPitch = pitchWhere(q)

  const companies = await prisma.company.findMany({
    where: {
      status: 'ACTIVE',
      city: q.city,
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
      // Always present, even with no filters: a company with no active pitch
      // has nothing to book and must not be listed.
      pitches: { some: matchingPitch },
    },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      city: true,
      addressLine1: true,
      lat: true,
      lng: true,
      workingHours: true,
      status: true,
      createdAt: true,
      pitches: { where: { isActive: true }, select: { id: true, hourlyRate: true } },
    },
  })

  const companyIds = companies.map(c => c.id)

  // One grouped query for every company's reviews, rather than one per card.
  const stats = companyIds.length
    ? await pitchStats({ companyId: { in: companyIds }, isActive: true })
    : new Map<string, PitchStats>()

  const freeCompanies = q.availableNow
    ? await companiesWithFreePitch(companyIds, matchingPitch, now)
    : null

  const hasCoords = q.lat !== undefined && q.lng !== undefined
  let sort: CompanySort = q.sort ?? (hasCoords ? 'distance' : 'rating')
  if (sort === 'distance' && !hasCoords) {
    console.warn('[discover] sort=distance without lat/lng; falling back to rating')
    sort = 'rating'
  }

  const rows: Row[] = []
  for (const c of companies) {
    const isOpenNow = isOpenAt(c.workingHours, now)
    // A pitch is only bookable while the venue is open.
    if (freeCompanies && (!isOpenNow || !freeCompanies.has(c.id))) continue

    const { avgRating, reviewCount } = companyRating(
      c.pitches.flatMap(p => (stats.has(p.id) ? [stats.get(p.id)!] : []))
    )

    rows.push({
      id: c.id,
      name: c.name,
      logoUrl: c.logoUrl,
      // Discover lists ACTIVE venues only, which always have these.
      city: c.city ?? '',
      address: c.addressLine1 ?? '',
      lat: c.lat,
      lng: c.lng,
      avgRating,
      reviewCount,
      pitchCount: c.pitches.length,
      priceFrom: Math.min(...c.pitches.map(p => Number(p.hourlyRate))),
      isOpenNow,
      distanceKm:
        hasCoords && c.lat !== null && c.lng !== null
          ? round1(haversineKm(q.lat!, q.lng!, c.lat, c.lng))
          : null,
      isVerified: c.status === 'ACTIVE',
      createdAt: c.createdAt,
    })
  }

  // Name then id as tie-breakers, so equal keys keep a stable order and the
  // cursor means the same thing from one page to the next.
  rows.sort(
    (a, b) => COMPARATORS[sort](a, b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  )

  let start = 0
  if (q.cursor) {
    const index = rows.findIndex(r => r.id === q.cursor)
    if (index === -1) throw validationError('Invalid cursor')
    start = index + 1
  }
  const page = rows.slice(start, start + q.limit)
  const hasMore = start + q.limit < rows.length

  return {
    companies: page.map(({ createdAt: _createdAt, ...item }) => item),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    total: rows.length,
  }
}

/**
 * Companies with at least one matching pitch that has no live booking in the
 * next AVAILABLE_NOW_WINDOW_HOURS. One query for the whole candidate set.
 */
async function companiesWithFreePitch(
  companyIds: string[],
  matchingPitch: Prisma.PitchWhereInput,
  now: Date
): Promise<Set<string>> {
  if (!companyIds.length) return new Set()
  const windowEnd = new Date(now.getTime() + DISCOVER.AVAILABLE_NOW_WINDOW_HOURS * 60 * 60 * 1000)

  const free = await prisma.pitch.findMany({
    where: {
      ...matchingPitch,
      companyId: { in: companyIds },
      bookings: {
        none: {
          ...liveBookingWhere(now),
          startTime: { lt: windowEnd },
          endTime: { gt: now },
        },
      },
    },
    select: { companyId: true },
    distinct: ['companyId'],
  })
  return new Set(free.map(p => p.companyId))
}
