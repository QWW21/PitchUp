/**
 * A player's own bookings — E06-01, E06-02, E06-04.
 *
 * Nothing moves a booking to COMPLETED yet (the E11-10 job will, for
 * everyone). Until then, reading a player's bookings first settles their
 * own: a confirmed booking that has ended becomes COMPLETED, and a checkout
 * abandoned past its hold becomes CANCELLED. The same rule, applied lazily.
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import {
  BOOKING,
  NO_SHOW_DISPUTE_WINDOW_HOURS,
  REVIEW,
  bookingReference,
  cancellationRefund,
  describeRefundPolicy,
  refundPolicyOf,
  endLabel,
  fromMinutes,
  venueClock,
  type BookingCounts,
  type BookingDetail,
  type BookingListItem,
  type BookingListPage,
  type BookingStatus,
  type BookingTab,
  type PaymentProviderName,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { chargedOnline } from './charged'
import { applyTrustEvent } from '@/lib/trust/apply'
import { recordStatus } from './status'

const HOUR = 3_600_000
const TEAM_NAMES = ['Team A', 'Team B', 'Team C']

/** Settles this player's finished and abandoned bookings. Idempotent. */
export const settlePlayerBookings = (playerId: string, now: Date = new Date()) =>
  settleBookings({ playerId }, now)

/**
 * Settles finished and abandoned bookings among `scope`: a player's, a
 * venue's (the manager pages), or everyone's (the nightly job, E11-10).
 * Returns how many of each it settled.
 */
export async function settleBookings(
  scope: Prisma.BookingWhereInput,
  now: Date = new Date()
): Promise<{ completed: number; cancelled: number }> {
  const holdStart = new Date(now.getTime() - BOOKING.PENDING_HOLD_MINUTES * 60_000)
  const [finished, abandoned] = await Promise.all([
    prisma.booking.findMany({
      where: { ...scope, status: 'CONFIRMED', endTime: { lte: now } },
      select: { id: true, playerId: true },
    }),
    prisma.booking.findMany({
      where: { ...scope, status: 'PENDING', createdAt: { lte: holdStart } },
      select: { id: true },
    }),
  ])
  const counts = { completed: finished.length, cancelled: abandoned.length }
  if (!finished.length && !abandoned.length) return counts
  await prisma.$transaction(async tx => {
    if (finished.length) {
      const ids = finished.map(b => b.id)
      await tx.booking.updateMany({
        where: { id: { in: ids }, status: 'CONFIRMED' },
        data: { status: 'COMPLETED' },
      })
      await recordStatus(tx, ids, 'COMPLETED')
      // +2 trust each (E12-02), within the monthly cap.
      for (const b of finished)
        await applyTrustEvent(tx, b.playerId, 'BOOKING_COMPLETED', b.id, now)
    }
    if (abandoned.length) {
      const ids = abandoned.map(b => b.id)
      await tx.booking.updateMany({
        where: { id: { in: ids }, status: 'PENDING' },
        data: {
          status: 'CANCELLED',
          cancelledBy: 'SYSTEM',
          cancelledAt: now,
          cancellationReason: 'Checkout not completed',
        },
      })
      await recordStatus(tx, ids, 'CANCELLED')
    }
  })
  return counts
}

function tabWhere(playerId: string, tab: BookingTab, now: Date): Prisma.BookingWhereInput {
  switch (tab) {
    case 'upcoming':
      return {
        playerId,
        endTime: { gt: now },
        OR: [
          { status: { in: ['CONFIRMED', 'AWAITING_APPROVAL'] } },
          {
            status: 'PENDING',
            createdAt: { gt: new Date(now.getTime() - BOOKING.PENDING_HOLD_MINUTES * 60_000) },
          },
        ],
      }
    case 'past':
      return { playerId, status: { in: ['COMPLETED', 'NO_SHOW'] } }
    case 'cancelled':
      // Only bookings that were real (paid): a declined card or a closed tab
      // is not something the player cancelled.
      return { playerId, status: 'CANCELLED', paidAt: { not: null } }
  }
}

const TAB_ORDER: Record<BookingTab, Prisma.BookingOrderByWithRelationInput[]> = {
  upcoming: [{ startTime: 'asc' }, { id: 'asc' }],
  past: [{ startTime: 'desc' }, { id: 'desc' }],
  cancelled: [{ cancelledAt: 'desc' }, { id: 'desc' }],
}

const listSelect = {
  id: true,
  status: true,
  startTime: true,
  endTime: true,
  totalAmount: true,
  refundAmount: true,
  paymentMethod: true,
  depositAmount: true,
  dueAtVenue: true,
  attendedAt: true,
  cancelledBy: true,
  review: { select: { id: true } },
  pitch: {
    select: {
      id: true,
      name: true,
      surfaceType: true,
      company: { select: { id: true, name: true, logoUrl: true } },
    },
  },
} satisfies Prisma.BookingSelect

type ListRow = Prisma.BookingGetPayload<{ select: typeof listSelect }>

/** Venue-local date and times of a booking. A midnight end reads 24:00. */
function venueTimes(start: Date, end: Date) {
  const s = venueClock(start)
  const e = venueClock(end)
  return {
    date: s.date,
    startTime: fromMinutes(s.minutes),
    endTime: endLabel(e.date === s.date ? e.minutes : 24 * 60),
    minutes: Math.round((end.getTime() - start.getTime()) / 60_000),
  }
}

const reviewOpen = (status: string, end: Date, hasReview: boolean, now: Date) =>
  status === 'COMPLETED' &&
  !hasReview &&
  now.getTime() < end.getTime() + REVIEW.SUBMIT_WINDOW_DAYS * 24 * HOUR

function toListItem(b: ListRow, now: Date): BookingListItem {
  return {
    id: b.id,
    reference: bookingReference(b.id),
    status: b.status,
    ...venueTimes(b.startTime, b.endTime),
    startsAt: b.startTime.toISOString(),
    pitch: { id: b.pitch.id, name: b.pitch.name, surfaceType: b.pitch.surfaceType },
    company: b.pitch.company,
    total: Number(b.totalAmount),
    refundAmount: b.refundAmount === null ? null : Number(b.refundAmount),
    paymentMethod: b.paymentMethod,
    dueAtVenue: Number(b.dueAtVenue),
    cancelledBy: b.cancelledBy,
    hasReview: !!b.review,
    canReview: reviewOpen(b.status, b.endTime, !!b.review, now),
  }
}

export async function listBookings(
  playerId: string,
  query: { tab: BookingTab; cursor?: string | undefined; limit: number },
  now: Date = new Date()
): Promise<BookingListPage> {
  await settlePlayerBookings(playerId, now)
  const rows = await prisma.booking.findMany({
    where: tabWhere(playerId, query.tab, now),
    orderBy: TAB_ORDER[query.tab],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: listSelect,
  })
  const page = rows.slice(0, query.limit)
  const hasMore = rows.length > query.limit
  return {
    items: page.map(b => toListItem(b, now)),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    hasMore,
  }
}

export async function countBookings(
  playerId: string,
  now: Date = new Date()
): Promise<BookingCounts> {
  await settlePlayerBookings(playerId, now)
  const [upcoming, unreviewed] = await Promise.all([
    prisma.booking.count({ where: tabWhere(playerId, 'upcoming', now) }),
    prisma.booking.count({
      where: {
        playerId,
        status: 'COMPLETED',
        review: null,
        endTime: { gt: new Date(now.getTime() - REVIEW.SUBMIT_WINDOW_DAYS * 24 * HOUR) },
      },
    }),
  ])
  return { upcoming, unreviewed }
}

// ── Detail ───────────────────────────────────────────────────────────────────

export const detailSelect = {
  ...listSelect,
  id: true,
  playerId: true,
  teamCount: true,
  teamsData: true,
  shirtSets: true,
  noteToManager: true,
  paidAt: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  paymentProvider: true,
  stripePaymentIntentId: true,
  cardBrand: true,
  cardLast4: true,
  refundPolicy: true,
  approvalDeadline: true,
  statusEvents: { orderBy: { createdAt: 'asc' }, select: { status: true, createdAt: true } },
  review: {
    select: {
      id: true,
      rating: true,
      text: true,
      isAnonymous: true,
      createdAt: true,
      deletedAt: true,
    },
  },
  noShow: { select: { reason: true, disputeStatus: true, createdAt: true } },
  pitch: {
    select: {
      id: true,
      name: true,
      surfaceType: true,
      size: true,
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          phone: true,
          addressLine1: true,
          city: true,
        },
      },
    },
  },
} satisfies Prisma.BookingSelect

export type DetailRow = Prisma.BookingGetPayload<{ select: typeof detailSelect }>

/** Bookings made before E06 have no timeline rows; their history is rebuilt from timestamps. */
function history(b: DetailRow): BookingDetail['statusHistory'] {
  // A game is played when it ends, not when it was settled (lazily, on a read).
  const at = (status: BookingStatus, when: Date) =>
    (status === 'COMPLETED' ? b.endTime : when).toISOString()
  const recorded = b.statusEvents.map(e => ({ status: e.status, at: at(e.status, e.createdAt) }))

  // Bookings made before the log existed: what the timestamps can tell,
  // ahead of whatever was recorded since (often just COMPLETED).
  const known = new Set(recorded.map(s => s.status))
  const steps: BookingDetail['statusHistory'] = []
  const add = (status: BookingStatus, when: Date) => {
    if (!known.has(status)) steps.push({ status, at: at(status, when) })
  }
  add('PENDING', b.createdAt)
  // Paid at a venue that confirms by hand: confirmed later, if at all (C-13).
  if (b.paidAt && !known.has('AWAITING_APPROVAL')) add('CONFIRMED', b.paidAt)
  if (recorded.length) return [...steps, ...recorded]
  if (b.status === 'CANCELLED') add('CANCELLED', b.cancelledAt ?? b.updatedAt)
  if (b.status === 'COMPLETED' || b.status === 'NO_SHOW') add(b.status, b.updatedAt)
  return steps
}

export function toDetail(b: DetailRow, now: Date = new Date()): BookingDetail {
  const times = venueTimes(b.startTime, b.endTime)
  const total = Number(b.totalAmount)
  const teams = Array.isArray(b.teamsData)
    ? (b.teamsData as { playerCount?: number; colour?: string }[])
    : []
  const review = b.review && !b.review.deletedAt ? b.review : null
  const cancellable =
    (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'AWAITING_APPROVAL') &&
    b.startTime > now
  const policy = refundPolicyOf(b.refundPolicy)
  const paid = b.paidAt ? chargedOnline(b) : 0
  // C-13: withdrawing a request the venue hasn't accepted gives everything back.
  const refund =
    b.status === 'AWAITING_APPROVAL'
      ? { percent: 100, amount: paid }
      : cancellationRefund(paid, b.startTime, now, policy)
  const disputeUntil = b.noShow
    ? new Date(b.noShow.createdAt.getTime() + NO_SHOW_DISPUTE_WINDOW_HOURS * HOUR)
    : null

  return {
    id: b.id,
    reference: bookingReference(b.id),
    status: b.status,
    ...times,
    startsAt: b.startTime.toISOString(),
    createdAt: b.createdAt.toISOString(),
    teamCount: b.teamCount,
    shirtSets: b.shirtSets,
    total,
    paidAt: b.paidAt?.toISOString() ?? null,
    cancellationReason: b.cancellationReason,
    paymentMethod: b.paymentMethod,
    deposit: b.depositAmount === null ? null : Number(b.depositAmount),
    dueAtVenue: Number(b.dueAtVenue),
    attendedAt: b.attendedAt?.toISOString() ?? null,
    pitch: {
      id: b.pitch.id,
      name: b.pitch.name,
      surfaceType: b.pitch.surfaceType,
      size: b.pitch.size,
    },
    company: {
      id: b.pitch.company.id,
      name: b.pitch.company.name,
      // Bookable venues are ACTIVE, so these are filled (E09 onboarding).
      address: b.pitch.company.addressLine1 ?? '',
      city: b.pitch.company.city ?? '',
      logoUrl: b.pitch.company.logoUrl,
      phone: b.pitch.company.phone,
    },
    teams: Array.from({ length: b.teamCount }, (_, t) => ({
      name: TEAM_NAMES[t]!,
      players: teams[t]?.playerCount ?? null,
      colour: teams[t]?.colour ?? null,
    })),
    note: b.noteToManager,
    payment: {
      provider: (b.paymentProvider as PaymentProviderName | null) ?? null,
      cardBrand: b.cardBrand,
      cardLast4: b.cardLast4,
      paidAt: b.paidAt?.toISOString() ?? null,
      refundAmount: b.refundAmount === null ? null : Number(b.refundAmount),
      refundedAt: b.refundAmount !== null ? (b.cancelledAt?.toISOString() ?? null) : null,
    },
    cancelledBy: b.cancelledBy,
    statusHistory: history(b),
    cancellation: cancellable
      ? { refundPercent: b.paidAt ? refund.percent : 0, refundAmount: refund.amount }
      : null,
    refundPolicy: describeRefundPolicy(policy),
    approvalDeadline: b.approvalDeadline?.toISOString() ?? null,
    review: review
      ? {
          id: review.id,
          rating: review.rating,
          text: review.text,
          isAnonymous: review.isAnonymous,
          createdAt: review.createdAt.toISOString(),
          editableUntil: new Date(
            review.createdAt.getTime() + REVIEW.EDIT_WINDOW_HOURS * HOUR
          ).toISOString(),
        }
      : null,
    canReview: reviewOpen(b.status, b.endTime, !!b.review, now),
    noShow: b.noShow
      ? {
          reason: b.noShow.reason,
          disputeStatus: b.noShow.disputeStatus,
          disputeUntil:
            b.noShow.disputeStatus === 'NONE' && disputeUntil && now < disputeUntil
              ? disputeUntil.toISOString()
              : null,
        }
      : null,
  }
}
