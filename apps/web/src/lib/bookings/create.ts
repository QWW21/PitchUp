/**
 * Creating a booking — E05-07.
 *
 * Order matters:
 * 1. Everything that can be checked without the lock (pitch, account, hours,
 *    duration, shirts) is checked first, so a bad request costs no lock.
 * 2. Inside one transaction, a per-pitch lock serialises bookings of that
 *    pitch: two players racing for 18:00 queue here, and the second one sees
 *    the first's booking and gets a 409. Reading overlapping rows "FOR UPDATE"
 *    (the ticket's idea) cannot do this: the competing row does not exist
 *    yet, so there is nothing to lock.
 * 3. The booking is created PENDING, then the payment is started. A payment
 *    service that is down cancels the booking again and nothing is charged.
 *
 * Paying at the venue (C-8): only the deposit is charged online. With a 0%
 * deposit nothing is, and the booking is confirmed at once.
 */
import 'server-only'
import {
  addDays,
  bookingPrice,
  bookingTrustGate,
  bookingReference,
  formatShortDuration,
  normalizeWeek,
  paymentMethodsFor,
  paymentSplit,
  rateFor,
  shirtSetsFor,
  toMinutes,
  trustTier,
  venueClock,
  venueTimeToUtc,
  type CreateBookingInput,
  type CreateBookingResult,
  sharedT,
} from '@pitchup/shared'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { getLocale } from '@/i18n/server'
import { ApiException, conflict, notFound, unauthorized, validationError } from '@/lib/api/errors'
import { coveredPricingOf, dayIntervals, exceptionDates } from '@/lib/venues/availability'
import { getPaymentProvider, providerFor } from '@/lib/payments'
import { getOrCreateCustomer } from '@/lib/payments/stripe'
import { notifyBookingPaid } from '@/lib/notifications/booking'
import { paidState } from './approval'
import { platformConfig } from '@/lib/admin/config'
import { holdExpiresAt, liveBookingWhere } from './live'
import { recordStatus } from './status'

const forbidden = (message: string, reason: string) =>
  new ApiException('FORBIDDEN', message, { reason })

export async function createBooking(
  userId: string,
  input: CreateBookingInput,
  now: Date = new Date()
): Promise<CreateBookingResult> {
  const provider = getPaymentProvider()
  if (!provider) throw new ApiException('SERVICE_UNAVAILABLE', 'api.paymentsNotSetUp')

  const [user, pitch] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true, deletedAt: true },
    }),
    prisma.pitch.findUnique({
      where: { id: input.pitchId },
      include: {
        company: {
          select: {
            name: true,
            status: true,
            workingHours: true,
            paymentMode: true,
            depositPercent: true,
            autoApproveBookings: true,
            refundFullHours: true,
            refundPartialHours: true,
            refundPartialPercent: true,
          },
        },
        shirtInventory: true,
        coveredSeasons: { select: { startDate: true, endDate: true } },
      },
    }),
  ])
  if (!user || user.deletedAt) throw unauthorized()
  if (!pitch || pitch.deletedAt || pitch.company.status !== 'ACTIVE') {
    throw notFound('api.pitchNotFound')
  }
  if (!pitch.isActive) throw forbidden('api.notTakingBookings', 'PITCH_INACTIVE')
  // E12-06: suspended players can't book, Poor ones hold one upcoming booking,
  // and a pitch may ask for a better trust score.
  const gate = bookingTrustGate(
    {
      score: user.trustScore,
      pitchMinScore: pitch.minTrustScore,
      activeBookings: await prisma.booking.count({
        where: {
          playerId: userId,
          status: { in: ['CONFIRMED', 'AWAITING_APPROVAL'] },
          endTime: { gt: now },
        },
      }),
    },
    await getLocale()
  )
  if (gate) {
    throw new ApiException('FORBIDDEN', gate.message, {
      reason: gate.reason,
      ...(gate.required ? { required: gate.required, current: gate.current } : {}),
    })
  }
  const methods = paymentMethodsFor(
    pitch.company.paymentMode,
    pitch.company.depositPercent,
    user.trustScore
  )
  if (!methods.includes(input.paymentMethod)) {
    throw forbidden(
      methods.length ? 'api.payMethodUnavailable' : 'api.venuePayTrust',
      'PAYMENT_METHOD_UNAVAILABLE'
    )
  }

  // Duration within this pitch's own limits (the schema checked the global ones).
  const startMin = toMinutes(input.startTime)
  const endMin = toMinutes(input.endTime)
  const minutes = endMin - startMin
  if (minutes < pitch.minBookingHours * 60 || minutes > pitch.maxBookingHours * 60) {
    throw new ApiException(
      'VALIDATION_ERROR',
      'api.bookingLength',
      { field: 'endTime' },
      {
        min: formatShortDuration(pitch.minBookingHours * 60),
        max: formatShortDuration(pitch.maxBookingHours * 60),
      }
    )
  }

  // The date and the opening hours, on the venue's calendar.
  const today = venueClock(now).date
  if (input.date < today) throw validationError('api.datePassed', { field: 'date' })
  if (input.date > addDays(today, pitch.advanceBookingDays)) {
    throw new ApiException(
      'VALIDATION_ERROR',
      'api.advanceDays',
      { field: 'date' },
      { n: pitch.advanceBookingDays }
    )
  }
  const schedule = {
    id: pitch.id,
    isActive: pitch.isActive,
    advanceBookingDays: pitch.advanceBookingDays,
    week: normalizeWeek(pitch.company.workingHours),
    pitchWeek: pitch.workingHours ? normalizeWeek(pitch.workingHours) : null,
  }
  const intervals = dayIntervals(
    schedule,
    input.date,
    await exceptionDates(pitch.id, input.date, input.date)
  )
  if (!intervals.some(([open, close]) => startMin >= open && endMin <= close)) {
    throw validationError('api.pitchNotOpen', {
      reason: 'OUTSIDE_OPENING_HOURS',
    })
  }
  const startTime = venueTimeToUtc(input.date, startMin)
  const endTime = venueTimeToUtc(input.date, endMin)
  if (startTime <= now) throw validationError('api.timePassed', { field: 'startTime' })

  // Free shirts (C-1): one set per team but one, from this pitch's stock.
  // Only one booking uses a pitch at a time, so the stock is never shared.
  const sets = shirtSetsFor(input.teamCount, input.wantsShirts)
  const stock = new Map(pitch.shirtInventory.map(s => [s.colour as string, s.quantity]))
  if (sets && !pitch.hasShirts) throw validationError('api.noShirts')
  const totalSets = [...stock.values()].reduce((a, b) => a + b, 0)
  if (sets > totalSets) {
    throw new ApiException(
      'CONFLICT',
      'api.shirtSets',
      { reason: 'SHIRTS_UNAVAILABLE' },
      { count: totalSets }
    )
  }
  for (const team of input.teamsData) {
    if (team.colour && !(stock.get(team.colour)! > 0)) {
      const st = sharedT(await getLocale())
      const key = `shirt.${team.colour}` as 'shirt.RED'
      throw new ApiException('VALIDATION_ERROR', 'api.noColourShirts', undefined, {
        colour: st.has(key) ? st(key) : team.colour.toLowerCase(),
      })
    }
  }

  // C-14: the day's rate, or the chosen air's while covered (cold by default).
  const rate = rateFor(coveredPricingOf(pitch), input.date, input.airType)
  if (!rate) {
    throw validationError('api.airNotOffered', { field: 'airType', reason: 'AIR_NOT_OFFERED' })
  }

  // E15: the commission is the admin's current setting, kept on the booking.
  const price = bookingPrice(rate.rate, minutes, (await platformConfig()).platformFeePercent)
  const split = paymentSplit(price.total, input.paymentMethod, pitch.company.depositPercent)
  // Nothing to charge online: confirmed now (or sent to the venue), like a paid booking.
  const free = split.payNow === 0
  const settled = paidState(pitch.company.autoApproveBookings, now, startTime)

  const { booking, superseded } = await prisma.$transaction(async tx => {
    // Serialises bookings of this pitch until the transaction ends.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pitch.id}))`

    const overlapping = await tx.booking.findMany({
      where: {
        pitchId: pitch.id,
        ...liveBookingWhere(now),
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: {
        id: true,
        playerId: true,
        status: true,
        paymentProvider: true,
        stripePaymentIntentId: true,
      },
    })
    // The player's own unpaid attempt (a declined card, a closed tab) is
    // replaced by this one rather than blocking it.
    const own = overlapping.filter(b => b.playerId === userId && b.status === 'PENDING')
    if (overlapping.length > own.length) {
      throw conflict('api.justBooked', { reason: 'SLOT_CONFLICT' })
    }
    if (own.length) {
      await tx.booking.updateMany({
        where: { id: { in: own.map(b => b.id) } },
        data: {
          status: 'CANCELLED',
          cancelledBy: 'SYSTEM',
          cancelledAt: now,
          cancellationReason: 'Replaced by a new checkout',
        },
      })
      await recordStatus(
        tx,
        own.map(b => b.id),
        'CANCELLED'
      )
    }

    const booking = await tx.booking.create({
      data: {
        pitchId: pitch.id,
        playerId: userId,
        startTime,
        endTime,
        teamCount: input.teamCount,
        teamsData: input.teamsData,
        shirtSets: sets,
        ...(input.noteToManager ? { noteToManager: input.noteToManager } : {}),
        status: free ? settled.status : 'PENDING',
        ...(free && settled.approvalDeadline ? { approvalDeadline: settled.approvalDeadline } : {}),
        // C-10: the policy the player agrees to now.
        refundPolicy: {
          fullRefundHours: pitch.company.refundFullHours,
          partialRefundHours: pitch.company.refundPartialHours,
          partialRefundPercent: pitch.company.refundPartialPercent,
        },
        pitchRateSnapshot: rate.rate,
        airType: rate.airType,
        platformFee: price.platformFee,
        totalAmount: price.total,
        paymentMethod: split.method,
        depositAmount: split.deposit,
        dueAtVenue: split.dueAtVenue,
        paymentProvider: free ? null : provider.name,
      },
      select: { id: true, createdAt: true },
    })
    await recordStatus(tx, booking.id, 'PENDING')
    if (free) await recordStatus(tx, booking.id, settled.status)
    return { booking, superseded: own }
  })

  for (const old of superseded) {
    if (old.stripePaymentIntentId) {
      void providerFor(old.paymentProvider)?.cancelPayment(old.stripePaymentIntentId)
    }
  }

  const result = {
    bookingId: booking.id,
    reference: bookingReference(booking.id),
    total: price.total,
    holdExpiresAt: holdExpiresAt(booking.createdAt).toISOString(),
    payNow: split.payNow,
    dueAtVenue: split.dueAtVenue,
  }
  if (free) {
    // Best effort, as after a payment: a mail outage must not undo the booking.
    await notifyBookingPaid(booking.id).catch(caught =>
      console.error(
        `[bookings] Confirmation notice for ${booking.id} failed:`,
        caught instanceof Error ? caught.message : 'unknown error'
      )
    )
    return { ...result, payment: { provider: 'none' } }
  }

  let payment
  try {
    payment = await provider.createPayment({
      bookingId: booking.id,
      userId,
      amountRon: split.payNow,
      description: `${pitch.name}, ${pitch.company.name} — ${input.date} ${input.startTime}–${input.endTime}`,
      customerId: provider.name === 'stripe' ? await getOrCreateCustomer(userId) : null,
      paymentMethodId: input.paymentMethodId,
      // Fair and Poor players must have a card on file (PRD §9.1): this one stays.
      saveCard: trustTier(user.trustScore).requiresCardOnFile,
    })
  } catch (caught) {
    // Booking id only: payment errors can carry card details.
    console.error(
      `[bookings] Could not start the payment for ${booking.id}:`,
      caught instanceof Error ? caught.message : 'unknown error'
    )
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledBy: 'SYSTEM',
          cancelledAt: new Date(),
          cancellationReason: 'Payment service unavailable',
        },
      }),
      recordStatus(prisma, booking.id, 'CANCELLED'),
    ])
    throw new ApiException('SERVICE_UNAVAILABLE', 'api.paymentsDown')
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: { stripePaymentIntentId: payment.id },
  })

  return {
    ...result,
    payment:
      provider.name === 'stripe' && payment.clientSecret
        ? {
            provider: 'stripe',
            clientSecret: payment.clientSecret,
            publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
          }
        : { provider: 'test' },
  }
}
