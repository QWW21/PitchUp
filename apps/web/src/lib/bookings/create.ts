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
  bookingReference,
  normalizeWeek,
  paymentMethodsFor,
  paymentSplit,
  shirtSetsFor,
  toMinutes,
  trustTier,
  venueClock,
  venueTimeToUtc,
  type CreateBookingInput,
  type CreateBookingResult,
} from '@pitchup/shared'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { ApiException, conflict, notFound, unauthorized, validationError } from '@/lib/api/errors'
import { dayIntervals, exceptionDates } from '@/lib/venues/availability'
import { getPaymentProvider, providerFor } from '@/lib/payments'
import { getOrCreateCustomer } from '@/lib/payments/stripe'
import { sendBookingConfirmedEmail } from '@/lib/emails/booking-confirmed'
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
  if (!provider) throw new ApiException('SERVICE_UNAVAILABLE', 'Payments are not set up yet')

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
          },
        },
        shirtInventory: true,
      },
    }),
  ])
  if (!user || user.deletedAt) throw unauthorized()
  if (!pitch || pitch.deletedAt || pitch.company.status !== 'ACTIVE') {
    throw notFound('Pitch not found')
  }
  if (!pitch.isActive) throw forbidden('This pitch is not taking bookings', 'PITCH_INACTIVE')
  if (!trustTier(user.trustScore).canBook) {
    throw forbidden('Your account cannot make bookings right now', 'TRUST_SCORE_TOO_LOW')
  }
  const methods = paymentMethodsFor(
    pitch.company.paymentMode,
    pitch.company.depositPercent,
    user.trustScore
  )
  if (!methods.includes(input.paymentMethod)) {
    throw forbidden(
      methods.length
        ? 'That way of paying is not available here'
        : 'This venue takes payment at the venue, for players with a trust score of 70 or more',
      'PAYMENT_METHOD_UNAVAILABLE'
    )
  }

  // Duration within this pitch's own limits (the schema checked the global ones).
  const startMin = toMinutes(input.startTime)
  const endMin = toMinutes(input.endTime)
  const minutes = endMin - startMin
  if (minutes < pitch.minBookingHours * 60 || minutes > pitch.maxBookingHours * 60) {
    throw validationError(
      `This pitch is booked for ${pitch.minBookingHours}–${pitch.maxBookingHours} hours at a time`,
      { field: 'endTime' }
    )
  }

  // The date and the opening hours, on the venue's calendar.
  const today = venueClock(now).date
  if (input.date < today) throw validationError('That date has passed', { field: 'date' })
  if (input.date > addDays(today, pitch.advanceBookingDays)) {
    throw validationError(`Bookings open ${pitch.advanceBookingDays} days ahead`, { field: 'date' })
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
    throw validationError('The pitch is not open for all of that time', {
      reason: 'OUTSIDE_OPENING_HOURS',
    })
  }
  const startTime = venueTimeToUtc(input.date, startMin)
  const endTime = venueTimeToUtc(input.date, endMin)
  if (startTime <= now) throw validationError('That time has passed', { field: 'startTime' })

  // Free shirts (C-1): one set per team but one, from this pitch's stock.
  // Only one booking uses a pitch at a time, so the stock is never shared.
  const sets = shirtSetsFor(input.teamCount, input.wantsShirts)
  const stock = new Map(pitch.shirtInventory.map(s => [s.colour as string, s.quantity]))
  if (sets && !pitch.hasShirts) throw validationError('This pitch does not lend shirts')
  const totalSets = [...stock.values()].reduce((a, b) => a + b, 0)
  if (sets > totalSets) {
    throw conflict(`This pitch has ${totalSets} set${totalSets === 1 ? '' : 's'} of shirts`, {
      reason: 'SHIRTS_UNAVAILABLE',
    })
  }
  for (const team of input.teamsData) {
    if (team.colour && !(stock.get(team.colour)! > 0)) {
      throw validationError(`There are no ${team.colour.toLowerCase()} shirts here`)
    }
  }

  const price = bookingPrice(Number(pitch.hourlyRate), minutes)
  const split = paymentSplit(price.total, input.paymentMethod, pitch.company.depositPercent)
  // Nothing to charge online: confirmed now, like a paid booking.
  const free = split.payNow === 0

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
      throw conflict('Someone has just booked that time', { reason: 'SLOT_CONFLICT' })
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
        status: free ? 'CONFIRMED' : 'PENDING',
        pitchRateSnapshot: pitch.hourlyRate,
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
    if (free) await recordStatus(tx, booking.id, 'CONFIRMED')
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
    await sendBookingConfirmedEmail(booking.id).catch(caught =>
      console.error(
        `[bookings] Confirmation email for ${booking.id} failed:`,
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
    throw new ApiException(
      'SERVICE_UNAVAILABLE',
      'Payments are unavailable right now. Nothing was charged; please try again shortly.'
    )
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
