/**
 * Company detail — E04-01. Used by the API route and server-rendered by the
 * web page directly, so the page does not call its own API over HTTP.
 */
import 'server-only'
import { isOpenAt, normalizeWeek, type CompanyDetail } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { companyRating, pitchStats, publicRating } from './ratings'

/** Null for an unknown company, or one not approved (pending or suspended). */
export async function getCompanyDetail(
  id: string,
  now: Date = new Date()
): Promise<CompanyDetail | null> {
  const company = await prisma.company.findFirst({
    where: { id, status: 'ACTIVE' },
    include: {
      pitches: {
        where: { isActive: true, deletedAt: null },
        orderBy: { name: 'asc' },
        include: { photos: { orderBy: { order: 'asc' }, take: 1, select: { url: true } } },
      },
    },
  })
  if (!company) return null

  const stats = await pitchStats({ companyId: id, isActive: true })

  return {
    id: company.id,
    name: company.name,
    description: company.description,
    logoUrl: company.logoUrl,
    websiteUrl: company.websiteUrl,
    // An empty value is "no phone", not a number to dial.
    phone: company.phone?.trim() || null,
    // Public pages show ACTIVE venues only, which onboarding filled in.
    email: company.email ?? '',
    addressLine1: company.addressLine1 ?? '',
    addressLine2: company.addressLine2,
    city: company.city ?? '',
    country: company.country,
    postalCode: company.postalCode,
    lat: company.lat,
    lng: company.lng,
    workingHours: normalizeWeek(company.workingHours),
    isVerified: company.status === 'ACTIVE',
    isOpenNow: isOpenAt(company.workingHours, now),
    ...companyRating([...stats.values()]),
    pitches: company.pitches.map(p => {
      const s = stats.get(p.id)
      return {
        id: p.id,
        name: p.name,
        surfaceType: p.surfaceType,
        size: p.size,
        hourlyRate: Number(p.hourlyRate),
        coverPhotoUrl: p.photos[0]?.url ?? null,
        avgRating: publicRating(s?.mean ?? null, s?.count ?? 0),
        reviewCount: s?.count ?? 0,
        isActive: p.isActive,
      }
    }),
  }
}
