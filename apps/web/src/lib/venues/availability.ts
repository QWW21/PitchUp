/**
 * Slot availability for one pitch — E04-03, with the month calendar and the
 * booking checks of E05 built on the same pieces.
 *
 * Slots are 30 minutes of the venue's wall clock, converted to real instants
 * for the booking overlap test. The ticket's sample builds slot times as UTC
 * (`${date}T08:00:00Z`), which in Romania is 10:00 or 11:00 local — every slot
 * would be off by the zone offset.
 */
import 'server-only'
import {
  BOOKING,
  addDays,
  airOptionsOn,
  rateFor,
  fromMinutes,
  intersectIntervals,
  normalizeWeek,
  openIntervalsOn,
  venueClock,
  venueTimeToUtc,
  type CalendarDay,
  type CoveredPricing,
  type DayHours,
  type PitchAvailability,
} from '@pitchup/shared'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notFound, validationError } from '@/lib/api/errors'
import { liveBookingWhere } from '@/lib/bookings/live'

const SLOT_MINUTES = BOOKING.SLOT_MINUTES

/** What decides whether a pitch is open on a date. */
export interface PitchSchedule {
  id: string
  isActive: boolean
  advanceBookingDays: number
  week: DayHours[]
  /** The pitch's own hours (E10-10), always inside the venue's; null follows the venue. */
  pitchWeek: DayHours[] | null
}

interface Span {
  startTime: Date
  endTime: Date
}

export async function loadSchedule(pitchId: string): Promise<PitchSchedule> {
  const pitch = await prisma.pitch.findFirst({
    where: { id: pitchId, deletedAt: null, company: { status: 'ACTIVE' } },
    select: {
      id: true,
      isActive: true,
      advanceBookingDays: true,
      workingHours: true,
      company: { select: { workingHours: true } },
    },
  })
  if (!pitch) throw notFound('api.pitchNotFound')
  return {
    id: pitch.id,
    isActive: pitch.isActive,
    advanceBookingDays: pitch.advanceBookingDays,
    week: normalizeWeek(pitch.company.workingHours),
    pitchWeek: pitch.workingHours ? normalizeWeek(pitch.workingHours) : null,
  }
}

/** Opening intervals on a date, in minutes; none when closed for any reason. */
export function dayIntervals(
  schedule: PitchSchedule,
  date: string,
  exceptions: Set<string>
): [number, number][] {
  if (!schedule.isActive || exceptions.has(date)) return []
  const venue = openIntervalsOn(schedule.week, date)
  // Cut to the venue's hours as well, in case those changed after the pitch's were set.
  return schedule.pitchWeek
    ? intersectIntervals(venue, openIntervalsOn(schedule.pitchWeek, date))
    : venue
}

export async function exceptionDates(pitchId: string, from: string, to: string) {
  const rows = await prisma.pitchException.findMany({
    where: {
      pitchId,
      date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
    },
    select: { date: true },
  })
  return new Set(rows.map(r => r.date.toISOString().slice(0, 10)))
}

/** Every 30-minute slot of a day, judged against the bookings that occupy it. */
export function slotsFor(
  date: string,
  intervals: [number, number][],
  bookings: Span[],
  now: Date
): PitchAvailability['slots'] {
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
  return slots
}

/** Live bookings touching [from, to) on the venue's calendar. */
function bookingsBetween(pitchId: string, from: string, toExclusive: string, now: Date) {
  return prisma.booking.findMany({
    where: {
      pitchId,
      ...liveBookingWhere(now),
      startTime: { lt: venueTimeToUtc(toExclusive, 0) },
      endTime: { gt: venueTimeToUtc(from, 0) },
    },
    select: { startTime: true, endTime: true },
  })
}

/** A pitch's rates and covered seasons (C-14), from a row that includes them. */
export function coveredPricingOf(p: {
  hourlyRate: Prisma.Decimal
  coveredColdRate: Prisma.Decimal | null
  coveredHotRate: Prisma.Decimal | null
  coveredSeasons: { startDate: Date; endDate: Date }[]
}): CoveredPricing {
  const day = (d: Date) => d.toISOString().slice(0, 10)
  return {
    hourlyRate: Number(p.hourlyRate),
    coveredColdRate: p.coveredColdRate === null ? null : Number(p.coveredColdRate),
    coveredHotRate: p.coveredHotRate === null ? null : Number(p.coveredHotRate),
    seasons: p.coveredSeasons.map(s => ({ startDate: day(s.startDate), endDate: day(s.endDate) })),
  }
}

export const coveredPricingSelect = {
  hourlyRate: true,
  coveredColdRate: true,
  coveredHotRate: true,
  coveredSeasons: { select: { startDate: true, endDate: true } },
} as const

/** The day's price: the all-year rate, or the air on offer while covered. */
async function dayPrice(pitchId: string, date: string) {
  const row = await prisma.pitch.findUniqueOrThrow({
    where: { id: pitchId },
    select: coveredPricingSelect,
  })
  const pricing = coveredPricingOf(row)
  const airOptions = airOptionsOn(pricing, date).map(airType => ({
    airType,
    hourlyRate: rateFor(pricing, date, airType)!.rate,
  }))
  return {
    covered: airOptions.length > 0,
    hourlyRate: airOptions[0]?.hourlyRate ?? pricing.hourlyRate,
    airOptions,
  }
}

function checkBookableDate(schedule: PitchSchedule, date: string, now: Date) {
  // "Today" is the venue's today, not the server's.
  const today = venueClock(now).date
  if (date < today) throw validationError('api.pastAvailability')
  if (date > addDays(today, schedule.advanceBookingDays)) {
    throw validationError('api.beyondAdvance')
  }
}

export async function getAvailability(
  pitchId: string,
  date: string,
  now: Date = new Date()
): Promise<PitchAvailability> {
  const schedule = await loadSchedule(pitchId)
  checkBookableDate(schedule, date, now)

  const [exceptions, price] = await Promise.all([
    exceptionDates(pitchId, date, date),
    dayPrice(pitchId, date),
  ])
  const intervals = dayIntervals(schedule, date, exceptions)
  if (!intervals.length) {
    return { date, pitchId, isClosed: true, openTime: null, closeTime: null, slots: [], ...price }
  }

  // Includes a booking that started the evening before.
  const bookings = await bookingsBetween(pitchId, date, addDays(date, 1), now)
  const first = intervals[0]!
  const last = intervals[intervals.length - 1]!
  return {
    date,
    pitchId,
    isClosed: false,
    openTime: fromMinutes(first[0]),
    // 24:00 is written as such rather than wrapping to 00:00.
    closeTime: last[1] === 24 * 60 ? '24:00' : fromMinutes(last[1]),
    slots: slotsFor(date, intervals, bookings, now),
    ...price,
  }
}

/**
 * One status per day for the booking calendar — E05-02. One query for the
 * whole range, rather than the ticket's thirty-one availability calls per
 * month, which would also run into the per-IP rate limit.
 */
export async function getCalendar(
  pitchId: string,
  from: string,
  days: number,
  now: Date = new Date()
): Promise<CalendarDay[]> {
  const schedule = await loadSchedule(pitchId)
  const today = venueClock(now).date
  const lastBookable = addDays(today, schedule.advanceBookingDays)
  const to = addDays(from, days)
  const [exceptions, bookings] = await Promise.all([
    exceptionDates(pitchId, from, to),
    bookingsBetween(pitchId, from, to, now),
  ])

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i)
    if (date < today || date > lastBookable) return { date, status: 'closed' as const }
    const intervals = dayIntervals(schedule, date, exceptions)
    if (!intervals.length) return { date, status: 'closed' as const }
    const free = slotsFor(date, intervals, bookings, now).some(s => s.status === 'available')
    return { date, status: free ? ('available' as const) : ('full' as const) }
  })
}
