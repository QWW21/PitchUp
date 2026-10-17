/**
 * Users for the admins — E15-03.
 *
 * - The list: search by name or email, filter by role, trust tier (a score
 *   range: the tier is derived, never stored) and status, newest first.
 * - One user: profile, bookings, the latest trust changes, their venue.
 * - Suspending: no sign-in and every session ends (web and app) until
 *   reinstated. Bookings already made stay. An admin can't suspend
 *   themselves.
 * - Adjusting the score (decided 2026-10-17): with a reason, through the
 *   trust engine (clamped, in the history as ADMIN_ADJUSTMENT), and the
 *   player is told.
 * - Deleting: players only, as their own deletion does (bookings refunded,
 *   details wiped). A manager's account carries a venue: suspend it instead.
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import {
  TRUST_REASON_LABELS,
  TRUST_TIERS,
  deriveTier,
  type AdminUserDetail,
  type AdminUserPage,
  type AdminUserQuery,
  type AdminUserUpdate,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { applyTrustEvent } from '@/lib/trust/apply'
import { deliverSoon, notify } from '@/lib/notifications/dispatch'
import { closePlayerAccount } from '@/lib/profile/account'

const rowSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  trustScore: true,
  suspendedAt: true,
  deletedAt: true,
  createdAt: true,
  _count: { select: { bookings: true } },
} satisfies Prisma.UserSelect

type Row = Prisma.UserGetPayload<{ select: typeof rowSelect }>

const toRow = (u: Row) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  trustScore: u.trustScore,
  tier: deriveTier(u.trustScore),
  bookings: u._count.bookings,
  suspendedAt: u.suspendedAt?.toISOString() ?? null,
  deletedAt: u.deletedAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
})

export async function listUsers(query: AdminUserQuery): Promise<AdminUserPage> {
  const tier = query.tier ? TRUST_TIERS.find(t => t.label === query.tier) : undefined
  const rows = await prisma.user.findMany({
    where: {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(tier ? { trustScore: { gte: tier.min, lte: tier.max } } : {}),
      ...(query.status === 'deleted'
        ? { deletedAt: { not: null } }
        : query.status === 'suspended'
          ? { suspendedAt: { not: null }, deletedAt: null }
          : query.status === 'active'
            ? { suspendedAt: null, deletedAt: null }
            : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: rowSelect,
  })
  const more = rows.length > query.limit
  const page = rows.slice(0, query.limit)
  return { items: page.map(toRow), nextCursor: more ? page.at(-1)!.id : null }
}

export async function userDetail(userId: string, now: Date = new Date()): Promise<AdminUserDetail> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...rowSelect,
      phone: true,
      emailVerified: true,
      phoneVerified: true,
      suspensionReason: true,
      company: { select: { id: true, name: true, status: true } },
      trustScoreEvents: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 10,
        select: { id: true, reason: true, delta: true, note: true, createdAt: true },
      },
    },
  })
  if (!u) throw notFound('User not found')
  const [byStatus, upcoming, lateCancels] = await Promise.all([
    prisma.booking.groupBy({ by: ['status'], where: { playerId: userId }, _count: { _all: true } }),
    prisma.booking.count({
      where: {
        playerId: userId,
        status: { in: ['CONFIRMED', 'AWAITING_APPROVAL'] },
        startTime: { gt: now },
      },
    }),
    prisma.trustScoreEvent.count({
      where: { userId, reason: { in: ['LATE_CANCEL', 'VERY_LATE_CANCEL'] } },
    }),
  ])
  const count = (s: string) => byStatus.find(b => b.status === s)?._count._all ?? 0
  return {
    ...toRow(u),
    phone: u.phone,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    suspensionReason: u.suspensionReason,
    company: u.company,
    stats: {
      completed: count('COMPLETED'),
      upcoming,
      cancelled: count('CANCELLED'),
      noShows: count('NO_SHOW'),
      lateCancels,
    },
    trustHistory: u.trustScoreEvents.map(e => ({
      id: e.id,
      reason: e.reason,
      label: TRUST_REASON_LABELS[e.reason],
      delta: e.delta,
      note: e.note,
      at: e.createdAt.toISOString(),
    })),
  }
}

export async function updateUser(
  adminId: string,
  userId: string,
  input: AdminUserUpdate,
  now: Date = new Date()
): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true, suspendedAt: true },
  })
  if (!user || user.deletedAt) throw notFound('User not found')
  if (input.suspended !== undefined && userId === adminId) {
    throw new ApiException('FORBIDDEN', "You can't suspend your own account", {
      reason: 'SELF_SUSPEND',
    })
  }
  await prisma.$transaction(async tx => {
    if (input.suspended === true) {
      await tx.user.update({
        where: { id: userId },
        data: { suspendedAt: now, suspensionReason: input.suspensionReason ?? null },
      })
      // The app's sessions end too, not just the web's.
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      })
    } else if (input.suspended === false && user.suspendedAt) {
      await tx.user.update({
        where: { id: userId },
        data: { suspendedAt: null, suspensionReason: null },
      })
      await notify(tx, {
        userId,
        type: 'ADMIN_NOTICE',
        title: 'Your account is active again',
        body: 'PitchUp reinstated your account: you can sign in and book again.',
        data: {},
      })
    }
    if (input.trustScoreAdjust !== undefined) {
      const result = await applyTrustEvent(tx, userId, 'ADMIN_ADJUSTMENT', null, now, {
        delta: input.trustScoreAdjust,
        note: input.trustAdjustReason!,
      })
      await notify(tx, {
        userId,
        type: 'ADMIN_NOTICE',
        title: `PitchUp adjusted your trust score by ${input.trustScoreAdjust > 0 ? '+' : ''}${input.trustScoreAdjust}`,
        body: `${input.trustAdjustReason} Your score is now ${result.score}.`,
        data: { link: '/profile/trust-score' },
      })
    }
  })
  deliverSoon([userId])
  return userDetail(userId, now)
}

export async function adminDeleteUser(
  userId: string,
  reason: string,
  now: Date = new Date()
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, deletedAt: true },
  })
  if (!user || user.deletedAt) throw notFound('User not found')
  if (user.role !== 'PLAYER') {
    throw new ApiException(
      'VALIDATION_ERROR',
      'Only player accounts can be deleted; suspend a venue or admin account instead',
      { reason: 'NOT_A_PLAYER' }
    )
  }
  await closePlayerAccount(user, `Deleted by PitchUp: ${reason}`, now)
}
