/**
 * The manager's overview — E09-10: today's revenue and bookings (against the
 * same weekday last week), today's occupancy, this week's no-shows, and the
 * next ten bookings. "Today" is the venue's calendar day, not the server's.
 */
import 'server-only'
import {
  addDays,
  bookingReference,
  endLabel,
  fromMinutes,
  normalizeWeek,
  toMinutes,
  venueClock,
  venueTimeToUtc,
  type ManagerStats,
} from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { liveBookingWhere } from '@/lib/bookings/live'

const PAID = ['CONFIRMED', 'COMPLETED'] as const

/** Start and end of a venue day, as instants. */
const dayBounds = (date: string) => ({
  gte: venueTimeToUtc(date, 0),
  lt: venueTimeToUtc(addDays(date, 1), 0),
})

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000

/** "+12%" as 12; null when there is nothing to compare with. */
const delta = (now: number, before: number) =>
  before === 0 ? null : Math.round(((now - before) / before) * 100)

export async function managerStats(
  companyId: string,
  now: Date = new Date()
): Promise<ManagerStats> {
  const today = venueClock(now).date
  const lastWeek = addDays(today, -7)
  const ofCompany = { pitch: { companyId } }

  const [company, pitchCount, todays, lastWeeks, noShows, upcoming] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { workingHours: true } }),
    prisma.pitch.count({ where: { companyId, isActive: true } }),
    prisma.booking.findMany({
      where: { ...ofCompany, status: { in: [...PAID] }, startTime: dayBounds(today) },
      select: { totalAmount: true, startTime: true, endTime: true },
    }),
    prisma.booking.findMany({
      where: { ...ofCompany, status: { in: [...PAID] }, startTime: dayBounds(lastWeek) },
      select: { totalAmount: true },
    }),
    prisma.noShow.count({
      where: {
        booking: ofCompany,
        createdAt: { gte: venueTimeToUtc(addDays(today, -6), 0) },
      },
    }),
    prisma.booking.findMany({
      where: { ...ofCompany, AND: [liveBookingWhere(now)], startTime: { gt: now } },
      orderBy: { startTime: 'asc' },
      take: 10,
      select: {
        id: true,
        status: true,
        startTime: true,
        endTime: true,
        pitch: { select: { name: true } },
        player: { select: { name: true } },
      },
    }),
  ])

  const revenueToday = todays.reduce((sum, b) => sum + Number(b.totalAmount), 0)
  const revenueLastWeek = lastWeeks.reduce((sum, b) => sum + Number(b.totalAmount), 0)

  // Open minutes today: the venue's hours (overnight closes count to midnight
  // and on), times its active pitches.
  const hours = normalizeWeek(company.workingHours)[venueClock(venueTimeToUtc(today, 12 * 60)).day]!
  const openMinutes = hours.isClosed
    ? 0
    : (toMinutes(hours.closeTime) - toMinutes(hours.openTime) + 1440) % 1440 || 1440
  const capacity = openMinutes * pitchCount
  const booked = todays.reduce((sum, b) => sum + minutesBetween(b.startTime, b.endTime), 0)

  return {
    revenueToday,
    revenueDelta: delta(revenueToday, revenueLastWeek),
    bookingsToday: todays.length,
    bookingsDelta: delta(todays.length, lastWeeks.length),
    occupancyRate: capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0,
    noShowsThisWeek: noShows,
    upcoming: upcoming.map(b => {
      const start = venueClock(b.startTime)
      const end = venueClock(b.endTime)
      return {
        id: b.id,
        reference: bookingReference(b.id),
        date: start.date,
        startTime: fromMinutes(start.minutes),
        // A game ending at midnight reads 24:00, not 00:00.
        endTime: endLabel(end.minutes === 0 ? 1440 : end.minutes),
        pitch: b.pitch.name,
        player: b.player.name,
        status: b.status as 'PENDING' | 'CONFIRMED',
      }
    }),
  }
}
