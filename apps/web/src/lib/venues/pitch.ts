/**
 * Pitch detail — E04-02.
 */
import 'server-only'
import { PeakHoursSchema, normalizeWeek, type PitchDetail } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { publicRating } from './ratings'
import { reviewInclude, toReviewItem } from './reviews'

const RECENT_REVIEWS = 3

/**
 * Null for an unknown pitch or one whose company is not approved. An inactive
 * pitch is still returned — a player may hold a direct link — with
 * `isBookable: false`.
 */
export async function getPitchDetail(id: string): Promise<PitchDetail | null> {
  const pitch = await prisma.pitch.findFirst({
    where: { id, company: { status: 'ACTIVE' } },
    include: {
      company: {
        select: { id: true, name: true, logoUrl: true, status: true, workingHours: true },
      },
      photos: { orderBy: { order: 'asc' }, select: { id: true, url: true, order: true } },
      amenities: { orderBy: { amenityType: 'asc' } },
      shirtInventory: { orderBy: { colour: 'asc' } },
      reviews: {
        where: { moderationStatus: 'APPROVED' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: RECENT_REVIEWS,
        include: reviewInclude,
      },
    },
  })
  if (!pitch) return null

  const agg = await prisma.review.aggregate({
    where: { pitchId: id, moderationStatus: 'APPROVED' },
    _avg: { rating: true },
    _count: { _all: true },
  })

  const peak = PeakHoursSchema.safeParse(pitch.peakHoursDefinition ?? [])

  return {
    id: pitch.id,
    name: pitch.name,
    description: pitch.description,
    surfaceType: pitch.surfaceType,
    size: pitch.size,
    widthMeters: pitch.widthMeters,
    lengthMeters: pitch.lengthMeters,
    isActive: pitch.isActive,
    offPeakRate: Number(pitch.offPeakRate),
    peakRate: Number(pitch.peakRate),
    // Unreadable peak windows are treated as none: every hour off-peak.
    peakHoursDefinition: peak.success ? peak.data : [],
    minBookingHours: pitch.minBookingHours,
    maxBookingHours: pitch.maxBookingHours,
    advanceBookingDays: pitch.advanceBookingDays,
    hasShirts: pitch.hasShirts,
    shirtRentalPrice:
      pitch.hasShirts && pitch.shirtRentalPrice !== null ? Number(pitch.shirtRentalPrice) : null,
    photos: pitch.photos,
    amenities: pitch.amenities.map(a => ({
      amenityType: a.amenityType,
      isPaid: a.isPaid,
      price: a.price === null ? null : Number(a.price),
    })),
    shirtInventory: pitch.hasShirts
      ? pitch.shirtInventory.map(s => ({ colour: s.colour, quantity: s.quantity }))
      : [],
    avgRating: publicRating(agg._avg.rating, agg._count._all),
    reviewCount: agg._count._all,
    recentReviews: pitch.reviews.map(toReviewItem),
    company: {
      id: pitch.company.id,
      name: pitch.company.name,
      logoUrl: pitch.company.logoUrl,
      isVerified: pitch.company.status === 'ACTIVE',
    },
    workingHours: normalizeWeek(pitch.company.workingHours),
    isBookable: pitch.isActive,
  }
}
