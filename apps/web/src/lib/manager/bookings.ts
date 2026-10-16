/**
 * The manager's bookings — E11, growing C-8's minimal page.
 *
 * - The list (filters, cursor pages), the week calendar and one booking in
 *   full, all scoped to the manager's own company. Unlike a player's reads,
 *   these don't settle finished games: the manager may still confirm
 *   attendance, report a no-show or mark the game complete, and the nightly
 *   job (E11-10) settles whatever is left.
 * - Confirm attended (C-8): the player came and paid at the venue. For
 *   "deposit back" bookings the deposit is refunded to their card.
 * - Report no-show: 30 minutes to 4 hours after kick-off (PRD §9.3, E11-04).
 *   The venue keeps whatever was paid online, and the player loses 20 trust
 *   points. The player may dispute it (E06-04). Reporting twice is a no-op.
 * - Mark complete (E11-05): a confirmed booking that has ended.
 *
 * The actions run inside the pitch's lock, like booking and cancelling, so a
 * double click cannot refund twice or report and confirm the same booking.
 */
import 'server-only'
import type { Prisma } from '@prisma/client'
import {
  NO_SHOW_DISPUTE_WINDOW_HOURS,
  NO_SHOW_WINDOW,
  TRUST_SCORE_DELTAS,
  TRUST_SCORE_MIN,
  addDays,
  bookingReference,
  dayOfWeek,
  endLabel,
  fromMinutes,
  isWithinNoShowWindow,
  normalizeWeek,
  pitchColour,
  toMinutes,
  venueClock,
  venueTimeToUtc,
  type AvailabilityGap,
  type BookingStatus,
  type CalendarEvent,
  type ManagerBooking,
  type ManagerBookingDetail,
  type ManagerBookingPage,
  type ManagerBookingQuery,
  type ManagerCalendar,
  type VenuePaymentSettings,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { ApiException, notFound } from '@/lib/api/errors'
import { providerFor } from '@/lib/payments'
import { chargedOnline } from '@/lib/bookings/charged'
import { liveBookingWhere } from '@/lib/bookings/live'
import { recordStatus } from '@/lib/bookings/status'
import { managerCompany } from '@/lib/onboarding/company'
import { dayIntervals, exceptionDates, loadSchedule, slotsFor } from '@/lib/venues/availability'

const PLAYED: BookingStatus[] = ['CONFIRMED', 'COMPLETED']
const TEAM_NAMES = ['Team A', 'Team B', 'Team C']

/** The manager's approved company, or 403 NOT_ACTIVE. */
export async function activeCompany(ownerId: string) {
  const company = await managerCompany(ownerId)
  if (company?.status !== 'ACTIVE') {
    throw new ApiException('FORBIDDEN', 'Your venue is not approved yet', { reason: 'NOT_ACTIVE' })
  }
  return company
}

/**
 * Each pitch's calendar colour, by its place among the venue's pitches in
 * the order they were added, deleted ones included, so colours never shift.
 */
async function pitchColours(companyId: string) {
  const pitches = await prisma.pitch.findMany({
    where: { companyId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  })
  return new Map(pitches.map((p, i) => [p.id, pitchColour(i)]))
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
  player: { select: { name: true } },
} satisfies Prisma.BookingSelect

type Row = Prisma.BookingGetPayload<{ select: typeof rowSelect }>

const mayConfirm = (b: Row, now: Date) =>
  PLAYED.includes(b.status) && b.startTime <= now && !b.attendedAt && !b.noShow

const mayReportNoShow = (b: Row, now: Date) =>
  PLAYED.includes(b.status) && isWithinNoShowWindow(b.startTime, now) && !b.attendedAt && !b.noShow

const mayComplete = (b: Row, now: Date) => b.status === 'CONFIRMED' && b.endTime <= now

function venueTimes(start: Date, end: Date) {
  const s = venueClock(start)
  const e = venueClock(end)
  return {
    date: s.date,
    startTime: fromMinutes(s.minutes),
    endTime: endLabel(e.date === s.date ? e.minutes : 24 * 60),
  }
}

function toRow(b: Row, colours: Map<string, string>, now: Date): ManagerBooking {
  return {
    id: b.id,
    reference: bookingReference(b.id),
    status: b.status,
    ...venueTimes(b.startTime, b.endTime),
    pitch: { ...b.pitch, color: colours.get(b.pitch.id) ?? pitchColour(0) },
    player: { name: b.player.name },
    total: Number(b.totalAmount),
    paymentMethod: b.paymentMethod,
    deposit: b.depositAmount === null ? null : Number(b.depositAmount),
    dueAtVenue: Number(b.dueAtVenue),
    attendedAt: b.attendedAt?.toISOString() ?? null,
    canConfirmAttended: mayConfirm(b, now),
    canReportNoShow: mayReportNoShow(b, now),
    canComplete: mayComplete(b, now),
  }
}

// ── The list (E11-01) ────────────────────────────────────────────────────────

/** Newest first; filters combine. Dates are the venue's calendar days. */
export async function listManagerBookings(
  companyId: string,
  query: ManagerBookingQuery,
  now: Date = new Date()
): Promise<ManagerBookingPage> {
  const where: Prisma.BookingWhereInput = {
    // Another venue's pitch id simply matches nothing.
    pitch: { companyId, ...(query.pitchId ? { id: query.pitchId } : {}) },
    ...(query.status ? { status: query.status } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          startTime: {
            ...(query.dateFrom ? { gte: venueTimeToUtc(query.dateFrom, 0) } : {}),
            ...(query.dateTo ? { lt: venueTimeToUtc(addDays(query.dateTo, 1), 0) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          player: {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  }
  const [rows, colours] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: rowSelect,
    }),
    pitchColours(companyId),
  ])
  const page = rows.slice(0, query.limit)
  return {
    items: page.map(b => toRow(b, colours, now)),
    nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
  }
}

// ── The week (E11-02) ────────────────────────────────────────────────────────

/** The Monday of the week a date falls in. */
export const mondayOf = (date: string) => addDays(date, -((dayOfWeek(date) + 6) % 7))

export async function managerCalendar(
  companyId: string,
  week: string,
  pitchId: string | undefined,
  now: Date = new Date()
): Promise<ManagerCalendar> {
  const weekStart = mondayOf(week)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const [company, pitches, bookings, colours] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { workingHours: true } }),
    prisma.pitch.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.booking.findMany({
      where: {
        pitch: { companyId, ...(pitchId ? { id: pitchId } : {}) },
        startTime: {
          gte: venueTimeToUtc(weekStart, 0),
          lt: venueTimeToUtc(addDays(weekStart, 7), 0),
        },
        // Cancelled and abandoned bookings don't occupy anything.
        OR: [{ status: { in: ['COMPLETED', 'NO_SHOW'] } }, ...(liveBookingWhere(now).OR ?? [])],
      },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        totalAmount: true,
        pitch: { select: { id: true, name: true } },
        player: { select: { name: true } },
      },
    }),
    pitchColours(companyId),
  ])

  const events: CalendarEvent[] = bookings.map(b => ({
    id: b.id,
    pitchId: b.pitch.id,
    pitchName: b.pitch.name,
    pitchColor: colours.get(b.pitch.id) ?? pitchColour(0),
    ...venueTimes(b.startTime, b.endTime),
    status: b.status,
    playerName: b.player.name,
    total: Number(b.totalAmount),
  }))

  // The rows to draw: the venue's hours over the week, widened to fit every booking.
  const open = normalizeWeek(company.workingHours).filter(d => !d.isClosed)
  let from = open.length ? Math.min(...open.map(d => toMinutes(d.openTime))) : 7 * 60
  let to = open.length
    ? Math.max(
        ...open.map(d =>
          toMinutes(d.closeTime) <= toMinutes(d.openTime) ? 24 * 60 : toMinutes(d.closeTime)
        )
      )
    : 23 * 60
  for (const e of events) {
    from = Math.min(from, toMinutes(e.startTime))
    to = Math.max(to, e.endTime === '24:00' ? 24 * 60 : toMinutes(e.endTime))
  }
  return {
    weekStart,
    days,
    pitches: pitches.map(p => ({ ...p, color: colours.get(p.id) ?? pitchColour(0) })),
    from: Math.floor(from / 60) * 60,
    to: Math.ceil(to / 60) * 60,
    events,
  }
}

// ── One booking (E11-03) ─────────────────────────────────────────────────────

export async function managerBookingDetail(
  companyId: string,
  bookingId: string,
  now: Date = new Date()
): Promise<ManagerBookingDetail> {
  const owned = await prisma.booking.findFirst({
    where: { id: bookingId, pitch: { companyId } },
    select: { id: true },
  })
  // Another venue's booking is "not found", like a pitch: ids can't be probed.
  if (!owned) throw notFound('Booking not found')

  const [b, colours] = await Promise.all([
    prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        ...rowSelect,
        playerId: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
        cancelledAt: true,
        platformFee: true,
        teamCount: true,
        teamsData: true,
        shirtSets: true,
        noteToManager: true,
        refundAmount: true,
        cancellationReason: true,
        player: { select: { name: true, phone: true } },
        statusEvents: { orderBy: { createdAt: 'asc' }, select: { status: true, createdAt: true } },
        review: { select: { rating: true, text: true, createdAt: true, deletedAt: true } },
        noShow: { select: { id: true, reason: true, disputeStatus: true } },
      },
    }),
    pitchColours(companyId),
  ])

  const atVenue = { playerId: b.playerId, pitch: { companyId } }
  const [bookings, completed, noShows, lateCancels] = await Promise.all([
    prisma.booking.count({ where: { ...atVenue, status: { not: 'PENDING' } } }),
    prisma.booking.count({ where: { ...atVenue, status: 'COMPLETED' } }),
    prisma.booking.count({ where: { ...atVenue, status: 'NO_SHOW' } }),
    // Cancelled by the player within 24 hours of kick-off.
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "Booking" b JOIN "Pitch" p ON p.id = b."pitchId"
      WHERE b."playerId" = ${b.playerId} AND p."companyId" = ${companyId}
        AND b.status = 'CANCELLED' AND b."cancelledBy" = 'PLAYER'
        AND b."cancelledAt" > b."startTime" - interval '24 hours'`.then(r => Number(r[0]?.n ?? 0)),
  ])

  const total = Number(b.totalAmount)
  const fee = Number(b.platformFee)
  const teams = Array.isArray(b.teamsData)
    ? (b.teamsData as { playerCount?: number; colour?: string }[])
    : []
  const review = b.review && !b.review.deletedAt ? b.review : null
  return {
    ...toRow({ ...b, player: { name: b.player.name } }, colours, now),
    minutes: Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60_000),
    createdAt: b.createdAt.toISOString(),
    platformFee: fee,
    venuePayout: Math.round((total - fee) * 100) / 100,
    teams: Array.from({ length: b.teamCount }, (_, i) => ({
      name: TEAM_NAMES[i] ?? `Team ${i + 1}`,
      players: teams[i]?.playerCount ?? null,
      colour: teams[i]?.colour ?? null,
    })),
    shirtSets: b.shirtSets,
    note: b.noteToManager,
    refundAmount: b.refundAmount === null ? null : Number(b.refundAmount),
    cancellationReason: b.cancellationReason,
    player: {
      name: b.player.name,
      phone: b.player.phone,
      history: { bookings, completed, noShows, lateCancels },
    },
    statusHistory: timeline(b),
    review: review
      ? { rating: review.rating, text: review.text, createdAt: review.createdAt.toISOString() }
      : null,
    noShow: b.noShow ? { reason: b.noShow.reason, disputeStatus: b.noShow.disputeStatus } : null,
  }
}

/**
 * The booking's statuses, oldest first. Bookings made before the log existed
 * (or written by hand) get theirs rebuilt from timestamps, as the player's
 * page does. A game counts as played when it ends.
 */
function timeline(b: {
  status: BookingStatus
  createdAt: Date
  updatedAt: Date
  paidAt: Date | null
  cancelledAt: Date | null
  endTime: Date
  statusEvents: { status: BookingStatus; createdAt: Date }[]
}): ManagerBookingDetail['statusHistory'] {
  const at = (status: BookingStatus, when: Date) =>
    (status === 'COMPLETED' ? b.endTime : when).toISOString()
  const recorded = b.statusEvents.map(e => ({ status: e.status, at: at(e.status, e.createdAt) }))
  const known = new Set(recorded.map(e => e.status))
  const steps: ManagerBookingDetail['statusHistory'] = []
  const add = (status: BookingStatus, when: Date) => {
    if (!known.has(status)) steps.push({ status, at: at(status, when) })
  }
  add('PENDING', b.createdAt)
  // Paid, or played: a cancelled checkout that was never paid was never confirmed.
  if (b.paidAt || PLAYED.includes(b.status) || b.status === 'NO_SHOW') {
    add('CONFIRMED', b.paidAt ?? b.createdAt)
  }
  if (recorded.length) return [...steps, ...recorded]
  if (b.status !== 'PENDING' && b.status !== 'CONFIRMED')
    add(b.status, b.cancelledAt ?? b.updatedAt)
  return steps
}

// ── Actions ──────────────────────────────────────────────────────────────────

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

async function one(companyId: string, bookingId: string, now: Date) {
  const [b, colours] = await Promise.all([
    prisma.booking.findFirstOrThrow({
      where: { id: bookingId, pitch: { companyId } },
      select: rowSelect,
    }),
    pitchColours(companyId),
  ])
  return toRow(b, colours, now)
}

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
): Promise<ManagerBooking & { alreadyMarked: boolean }> {
  const already = await prisma.$transaction(async tx => {
    const b = await lockOwn(tx, companyId, bookingId)
    if (b.status === 'NO_SHOW') return true
    if (!mayReportNoShow(b, now)) {
      const since = now.getTime() - b.startTime.getTime()
      throw notAllowed(
        b.attendedAt || !PLAYED.includes(b.status)
          ? 'This booking is already settled'
          : since < NO_SHOW_WINDOW.FROM_MINUTES * 60_000
            ? `A no-show can be reported ${NO_SHOW_WINDOW.FROM_MINUTES} minutes after kick-off`
            : `No-shows can be reported for ${NO_SHOW_WINDOW.UNTIL_HOURS} hours after kick-off`
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
    return false
  })
  return { ...(await one(companyId, bookingId, now)), alreadyMarked: already }
}

/** E11-05: a confirmed booking that has ended becomes COMPLETED. */
export async function completeBooking(
  companyId: string,
  bookingId: string,
  now: Date = new Date()
): Promise<ManagerBooking> {
  await prisma.$transaction(async tx => {
    const b = await lockOwn(tx, companyId, bookingId)
    if (!mayComplete(b, now)) {
      throw notAllowed(
        b.status !== 'CONFIRMED'
          ? `This booking is ${b.status.toLowerCase().replace('_', '-')}`
          : 'This booking has not ended yet'
      )
    }
    await tx.booking.update({ where: { id: b.id }, data: { status: 'COMPLETED' } })
    await recordStatus(tx, b.id, 'COMPLETED')
  })
  return one(companyId, bookingId, now)
}

// ── Free time on a pitch (E11-05) ────────────────────────────────────────────

/** The stretches of a day with no booking, from the pitch's own schedule. */
export async function availabilityGaps(
  companyId: string,
  pitchId: string,
  date: string,
  now: Date = new Date()
): Promise<AvailabilityGap[]> {
  const pitch = await prisma.pitch.findFirst({
    where: { id: pitchId, companyId, deletedAt: null },
    select: { id: true },
  })
  if (!pitch) throw notFound('Pitch not found')
  // The manager sees the pitch's hours whether or not players can book it now.
  const schedule = { ...(await loadSchedule(pitchId)), isActive: true }
  const intervals = dayIntervals(schedule, date, await exceptionDates(pitchId, date, date))
  if (!intervals.length) return []
  const bookings = await prisma.booking.findMany({
    where: {
      pitchId,
      ...liveBookingWhere(now),
      startTime: { lt: venueTimeToUtc(addDays(date, 1), 0) },
      endTime: { gt: venueTimeToUtc(date, 0) },
    },
    select: { startTime: true, endTime: true },
  })
  const gaps: AvailabilityGap[] = []
  let open: number | null = null
  let last = -1
  const close = () => {
    if (open !== null) {
      gaps.push({ start: fromMinutes(open), end: endLabel(last), minutes: last - open })
    }
    open = null
  }
  for (const slot of slotsFor(date, intervals, bookings, now)) {
    const m = toMinutes(slot.time)
    if (slot.status !== 'available' || (open !== null && m !== last)) close()
    if (slot.status === 'available') {
      open ??= m
      last = m + 30
    }
  }
  close()
  return gaps
}

export async function savePaymentSettings(companyId: string, input: VenuePaymentSettings) {
  return prisma.company.update({
    where: { id: companyId },
    data: input,
    select: { paymentMode: true, depositPercent: true },
  })
}
