/**
 * The manager's Bookings page and its two actions — C-8 (the minimal version
 * agreed; E10/E11 build the full schedule on top of it).
 *
 * - Confirm attended: the player came and paid at the venue. For "deposit
 *   back" bookings the deposit is refunded to their card.
 * - Report no-show: from 30 minutes after kick-off (PRD §9.3). The venue
 *   keeps whatever was paid online, and the player loses 20 trust points.
 *   The player may dispute it (E06-04).
 *
 * Both run inside the pitch's lock, like booking and cancelling, so a double
 * click cannot refund twice or report and confirm the same booking.
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import {
  NO_SHOW_DISPUTE_WINDOW_HOURS,
  NO_SHOW_MARK_AFTER_MINUTES,
  TRUST_SCORE_DELTAS,
  TRUST_SCORE_MIN,
  bookingReference,
  endLabel,
  fromMinutes,
  venueClock,
  type ManagerBooking,
  type ManagerBookings,
  type VenuePaymentSettings,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { providerFor } from '@/lib/payments'
import { chargedOnline } from '@/lib/bookings/charged'
import { recordStatus } from '@/lib/bookings/status'
import { managerCompany } from '@/lib/onboarding/company'

const DAY = 24 * 3_600_000
const PLAYED: ManagerBooking['status'][] = ['CONFIRMED', 'COMPLETED']

/** The manager's approved company, or 403 NOT_ACTIVE. */
export async function activeCompany(ownerId: string) {
  const company = await managerCompany(ownerId)
  if (company?.status !== 'ACTIVE') {
    throw new ApiException('FORBIDDEN', 'Your venue is not approved yet', { reason: 'NOT_ACTIVE' })
  }
  return company
}

const rowSelect = {
  id: true,
  status: true,
  startTime: true,
  endTime: true,
  totalAmount: true,
  paymentMethod: true,
  depositAmount: true,
  dueAtVenue: true,
  attendedAt: true,
  noShow: { select: { id: true } },
  pitch: { select: { id: true, name: true } },
  player: { select: { name: true, phone: true } },
} satisfies Prisma.BookingSelect

type Row = Prisma.BookingGetPayload<{ select: typeof rowSelect }>

const mayConfirm = (b: Row, now: Date) =>
  PLAYED.includes(b.status) && b.startTime <= now && !b.attendedAt && !b.noShow

const mayReportNoShow = (b: Row, now: Date) =>
  PLAYED.includes(b.status) &&
  now.getTime() >= b.startTime.getTime() + NO_SHOW_MARK_AFTER_MINUTES * 60_000 &&
  !b.attendedAt &&
  !b.noShow

function toRow(b: Row, now: Date): ManagerBooking {
  const s = venueClock(b.startTime)
  const e = venueClock(b.endTime)
  return {
    id: b.id,
    reference: bookingReference(b.id),
    status: b.status,
    date: s.date,
    startTime: fromMinutes(s.minutes),
    endTime: endLabel(e.date === s.date ? e.minutes : 24 * 60),
    pitch: b.pitch,
    player: b.player,
    total: Number(b.totalAmount),
    paymentMethod: b.paymentMethod,
    deposit: b.depositAmount === null ? null : Number(b.depositAmount),
    dueAtVenue: Number(b.dueAtVenue),
    attendedAt: b.attendedAt?.toISOString() ?? null,
    canConfirmAttended: mayConfirm(b, now),
    canReportNoShow: mayReportNoShow(b, now),
  }
}

export async function listManagerBookings(
  companyId: string,
  now: Date = new Date()
): Promise<ManagerBookings> {
  const ofCompany = { pitch: { companyId } }
  const [upcoming, recent] = await Promise.all([
    prisma.booking.findMany({
      where: { ...ofCompany, status: 'CONFIRMED', startTime: { gt: now } },
      orderBy: { startTime: 'asc' },
      take: 50,
      select: rowSelect,
    }),
    prisma.booking.findMany({
      where: {
        ...ofCompany,
        status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
        startTime: { lte: now, gt: new Date(now.getTime() - 7 * DAY) },
      },
      orderBy: { startTime: 'desc' },
      take: 50,
      select: rowSelect,
    }),
  ])
  return { upcoming: upcoming.map(b => toRow(b, now)), recent: recent.map(b => toRow(b, now)) }
}

/** Finds a booking of this company and locks its pitch; 404 for anyone else's. */
async function lockOwn(tx: Prisma.TransactionClient, companyId: string, bookingId: string) {
  const found = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { pitchId: true, pitch: { select: { companyId: true } } },
  })
  if (!found || found.pitch.companyId !== companyId) throw notFound('Booking not found')
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.pitchId}))`
  return tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      ...rowSelect,
      playerId: true,
      paidAt: true,
      paymentProvider: true,
      stripePaymentIntentId: true,
    },
  })
}

const notAllowed = (message: string) =>
  new ApiException('CONFLICT', message, { reason: 'NOT_ALLOWED' })

export async function confirmAttended(
  companyId: string,
  bookingId: string,
  now: Date = new Date()
): Promise<ManagerBooking> {
  await prisma.$transaction(
    async tx => {
      const b = await lockOwn(tx, companyId, bookingId)
      if (!mayConfirm(b, now)) {
        throw notAllowed(
          b.startTime > now
            ? 'Attendance can be confirmed once the game has started'
            : 'This booking is already settled'
        )
      }
      const deposit = Number(b.depositAmount ?? 0)
      const refund =
        b.paymentMethod === 'VENUE_REFUND_DEPOSIT' &&
        deposit > 0 &&
        !!b.paidAt &&
        !!b.stripePaymentIntentId
      let refundId: string | null = null
      if (refund) {
        const provider = providerFor(b.paymentProvider)
        if (!provider) {
          throw new ApiException('SERVICE_UNAVAILABLE', 'Refunds are unavailable right now')
        }
        try {
          refundId = (await provider.refund(b.stripePaymentIntentId!, deposit)).refundId
        } catch (caught) {
          console.error(
            `[manager] Deposit refund for ${b.id} failed:`,
            caught instanceof Error ? caught.message : 'unknown error'
          )
          throw new ApiException(
            'SERVICE_UNAVAILABLE',
            'The deposit could not be refunded right now. Nothing changed; please try again.'
          )
        }
      }
      await tx.booking.update({
        where: { id: b.id },
        data: {
          attendedAt: now,
          ...(refundId ? { refundAmount: deposit, stripeRefundId: refundId } : {}),
        },
      })
      if (refundId) {
        await tx.notification.create({
          data: {
            userId: b.playerId,
            type: 'REFUND_PROCESSED',
            title: 'Your deposit is on its way back',
            body: `${b.pitch.name} confirmed you played: ${deposit} RON is refunded to your card.`,
            data: { bookingId: b.id },
          },
        })
      }
    },
    // A Stripe refund happens inside the transaction.
    { timeout: 20_000 }
  )
  return one(companyId, bookingId, now)
}

export async function reportNoShow(
  companyId: string,
  managerId: string,
  bookingId: string,
  reason: string | undefined,
  now: Date = new Date()
): Promise<ManagerBooking> {
  await prisma.$transaction(async tx => {
    const b = await lockOwn(tx, companyId, bookingId)
    if (!mayReportNoShow(b, now)) {
      throw notAllowed(
        now.getTime() < b.startTime.getTime() + NO_SHOW_MARK_AFTER_MINUTES * 60_000
          ? `A no-show can be reported ${NO_SHOW_MARK_AFTER_MINUTES} minutes after kick-off`
          : 'This booking is already settled'
      )
    }
    const kept = b.paidAt ? chargedOnline(b) : 0
    await tx.booking.update({ where: { id: b.id }, data: { status: 'NO_SHOW' } })
    await recordStatus(tx, b.id, 'NO_SHOW')
    await tx.noShow.create({
      data: {
        bookingId: b.id,
        reportedByManagerId: managerId,
        ...(reason ? { reason } : {}),
        // What the venue keeps: the deposit, or the online payment.
        penaltyAmount: kept,
      },
    })
    const player = await tx.user.findUniqueOrThrow({
      where: { id: b.playerId },
      select: { trustScore: true },
    })
    const delta = TRUST_SCORE_DELTAS.NO_SHOW
    await tx.user.update({
      where: { id: b.playerId },
      data: { trustScore: Math.max(TRUST_SCORE_MIN, player.trustScore + delta) },
    })
    await tx.trustScoreEvent.create({
      data: { userId: b.playerId, delta, reason: 'NO_SHOW', relatedBookingId: b.id },
    })
    await tx.notification.create({
      data: {
        userId: b.playerId,
        type: 'NO_SHOW_REPORTED',
        title: 'A no-show was reported',
        body: `${b.pitch.name} reported that you didn't come. You can dispute it within ${NO_SHOW_DISPUTE_WINDOW_HOURS} hours.`,
        data: { bookingId: b.id },
      },
    })
  })
  return one(companyId, bookingId, now)
}

async function one(companyId: string, bookingId: string, now: Date) {
  const b = await prisma.booking.findFirstOrThrow({
    where: { id: bookingId, pitch: { companyId } },
    select: rowSelect,
  })
  return toRow(b, now)
}

export async function savePaymentSettings(companyId: string, input: VenuePaymentSettings) {
  return prisma.company.update({
    where: { id: companyId },
    data: input,
    select: { paymentMode: true, depositPercent: true },
  })
}
