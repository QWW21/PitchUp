/**
 * The platform's figures — E15-05, all at once. "Bookings" and GMV count
 * games that were played (completed, or confirmed and started), the same
 * rule the venues' analytics use; PitchUp's fees are what those bookings
 * stored.
 */
import 'server-only'
import type { AdminStats } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'

const DAY = 86_400_000

export async function platformStats(now: Date = new Date()): Promise<AdminStats> {
  const played = {
    OR: [
      { status: 'COMPLETED' as const },
      { status: 'CONFIRMED' as const, startTime: { lte: now } },
    ],
  }
  const [
    users,
    players,
    managers,
    suspendedUsers,
    companies,
    venueChanges,
    activePitches,
    all,
    recent,
    openDisputes,
    reportedReviews,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, role: 'PLAYER' } }),
    prisma.user.count({ where: { deletedAt: null, role: 'MANAGER' } }),
    prisma.user.count({ where: { deletedAt: null, suspendedAt: { not: null } } }),
    prisma.company.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.company.count({ where: { status: 'ACTIVE', changesSubmittedAt: { not: null } } }),
    prisma.pitch.count({
      where: { isActive: true, deletedAt: null, company: { status: 'ACTIVE' } },
    }),
    prisma.booking.aggregate({
      where: played,
      _sum: { totalAmount: true, platformFee: true },
      _count: { _all: true },
    }),
    prisma.booking.aggregate({
      where: { ...played, startTime: { gte: new Date(now.getTime() - 30 * DAY), lte: now } },
      _sum: { totalAmount: true },
    }),
    prisma.noShow.count({ where: { disputeStatus: 'OPEN' } }),
    prisma.review.count({ where: { deletedAt: null, reports: { some: {} } } }),
  ])
  const byStatus = (s: string) => companies.find(c => c.status === s)?._count._all ?? 0
  return {
    users,
    players,
    managers,
    suspendedUsers,
    companies: {
      total: companies.reduce((n, c) => n + c._count._all, 0),
      active: byStatus('ACTIVE'),
      pending: byStatus('PENDING'),
      suspended: byStatus('SUSPENDED'),
    },
    venueChanges,
    activePitches,
    bookings: all._count._all,
    openDisputes,
    reportedReviews,
    gmv: Number(all._sum.totalAmount ?? 0),
    last30dGmv: Number(recent._sum.totalAmount ?? 0),
    fees: Number(all._sum.platformFee ?? 0),
  }
}
