/**
 * Slot availability for one pitch on one date — E04-03.
 *
 * Slots are 30 minutes of the venue's wall clock, converted to real instants
 * for the booking overlap test. The ticket's sample builds slot times as UTC
 * (`${date}T08:00:00Z`), which in Romania is 10:00 or 11:00 local — every slot
 * would be off by the zone offset.
 */
import 'server-only'
import {
  addDays,
  fromMinutes,
  normalizeWeek,
  openIntervalsOn,
  venueClock,
  venueTimeToUtc,
  type PitchAvailability,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { notFound, validationError } from '@/lib/api/errors'

const SLOT_MINUTES = 30

export async function getAvailability(
  pitchId: string,
  date: string,
  now: Date = new Date()
): Promise<PitchAvailability> {
  const pitch = await prisma.pitch.findFirst({
    where: { id: pitchId, company: { status: 'ACTIVE' } },
    select: {
      isActive: true,
      advanceBookingDays: true,
      company: { select: { workingHours: true } },
    },
  })
  if (!pitch) throw notFound('Pitch not found')

  // "Today" is the venue's today, not the server's.
  const today = venueClock(now).date
  if (date < today) throw validationError('Cannot check availability for past dates')
  if (date > addDays(today, pitch.advanceBookingDays)) {
    throw validationError('Date beyond advance booking limit')
  }

  const closed: PitchAvailability = {
    date,
    pitchId,
    isClosed: true,
    openTime: null,
    closeTime: null,
    slots: [],
  }
  if (!pitch.isActive) return closed

  const exception = await prisma.pitchException.findUnique({
    where: { pitchId_date: { pitchId, date: new Date(`${date}T00:00:00Z`) } },
    select: { id: true },
  })
  if (exception) return closed

  const intervals = openIntervalsOn(normalizeWeek(pitch.company.workingHours), date)
  if (!intervals.length) return closed

  // Every live booking that touches this calendar day, including one that
  // started the evening before.
  const dayStart = venueTimeToUtc(date, 0)
  const dayEnd = venueTimeToUtc(date, 24 * 60)
  const bookings = await prisma.booking.findMany({
    where: {
      pitchId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    },
    select: { startTime: true, endTime: true },
  })

  const slots: PitchAvailability['slots'] = []
  for (const [open, close] of intervals) {
    for (let m = open; m + SLOT_MINUTES <= close; m += SLOT_MINUTES) {
      const start = venueTimeToUtc(date, m)
      const end = new Date(start.getTime() + SLOT_MINUTES * 60_000)
      // Half-open intervals: a booking ending at 10:00 leaves the 10:00 slot free.
      const booked = bookings.some(b => b.startTime < end && b.endTime > start)
      slots.push({
        time: fromMinutes(m),
        status: booked ? 'booked' : start <= now ? 'past' : 'available',
      })
    }
  }

  const first = intervals[0]!
  const last = intervals[intervals.length - 1]!
  return {
    date,
    pitchId,
    isClosed: false,
    openTime: fromMinutes(first[0]),
    // 24:00 is written as such rather than wrapping to 00:00.
    closeTime: last[1] === 24 * 60 ? '24:00' : fromMinutes(last[1]),
    slots,
  }
}
