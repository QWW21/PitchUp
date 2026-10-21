/**
 * Pitch detail — E04-02.
 */
import 'server-only'
import { describeRefundPolicy, normalizeWeek, venueClock, type PitchDetail } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { publicRating } from './ratings'
import { reviewInclude, toReviewItem } from './reviews'
import { getLocale } from '@/i18n/server'

const RECENT_REVIEWS = 3

/**
 * Null for an unknown pitch or one whose company is not approved. An inactive
 * pitch is still returned — a player may hold a direct link — with
 * `isBookable: false`.
 */
export async function getPitchDetail(id: string): Promise<PitchDetail | null> {
  const locale = await getLocale()
  const pitch = await prisma.pitch.findFirst({
    where: { id, deletedAt: null, company: { status: 'ACTIVE' } },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          status: true,
          workingHours: true,
          autoApproveBookings: true,
          refundFullHours: true,
          refundPartialHours: true,
          refundPartialPercent: true,
        },
      },
      photos: { orderBy: { order: 'asc' }, select: { id: true, url: true, order: true } },
      amenities: { orderBy: { amenityType: 'asc' } },
      shirtInventory: { orderBy: { colour: 'asc' } },
      // C-14: seasons not over yet.
      coveredSeasons: {
        where: { endDate: { gte: new Date(`${venueClock(new Date()).date}T00:00:00Z`) } },
        orderBy: { startDate: 'asc' },
      },
      reviews: {
        where: { moderationStatus: 'APPROVED', deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: RECENT_REVIEWS,
        include: reviewInclude,
      },
    },
  })
  if (!pitch) return null

  const agg = await prisma.review.aggregate({
    where: { pitchId: id, moderationStatus: 'APPROVED', deletedAt: null },
    _avg: { rating: true },
    _count: { _all: true },
  })

  return {
    id: pitch.id,
    name: pitch.name,
    description: pitch.description,
    surfaceType: pitch.surfaceType,
    size: pitch.size,
    widthMeters: pitch.widthMeters,
    lengthMeters: pitch.lengthMeters,
    isActive: pitch.isActive,
    hourlyRate: Number(pitch.hourlyRate),
    coveredColdRate: pitch.coveredColdRate === null ? null : Number(pitch.coveredColdRate),
    coveredHotRate: pitch.coveredHotRate === null ? null : Number(pitch.coveredHotRate),
    coveredSeasons: pitch.coveredSeasons.map(s => ({
      startDate: s.startDate.toISOString().slice(0, 10),
      endDate: s.endDate.toISOString().slice(0, 10),
    })),
    minBookingHours: pitch.minBookingHours,
    maxBookingHours: pitch.maxBookingHours,
    advanceBookingDays: pitch.advanceBookingDays,
    minTrustScore: pitch.minTrustScore,
    hasShirts: pitch.hasShirts,
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
    recentReviews: pitch.reviews.map(r => toReviewItem(r, locale)),
    company: {
      id: pitch.company.id,
      name: pitch.company.name,
      logoUrl: pitch.company.logoUrl,
      isVerified: pitch.company.status === 'ACTIVE',
      refundPolicy: describeRefundPolicy(
        {
          fullRefundHours: pitch.company.refundFullHours,
          partialRefundHours: pitch.company.refundPartialHours,
          partialRefundPercent: pitch.company.refundPartialPercent,
        },
        locale
      ),
      autoApproveBookings: pitch.company.autoApproveBookings,
    },
    workingHours: normalizeWeek(pitch.workingHours ?? pitch.company.workingHours),
    isBookable: pitch.isActive,
  }
}
