import type { Metadata } from 'next'
import { venueClock } from '@pitchup/shared'
import { requireActiveManager } from '@/lib/manager/access'
import { managerCalendar, mondayOf } from '@/lib/manager/bookings'
import { WeekCalendar } from '@/components/manager/WeekCalendar'

export const metadata: Metadata = { title: 'Calendar | PitchUp' }

type Props = { searchParams: Promise<{ week?: string }> }

/** The week's bookings across the venue's pitches — E11-07. `?week=` is any day of the week. */
export default async function CalendarPage({ searchParams }: Props) {
  const { company } = await requireActiveManager()
  const { week } = await searchParams
  const today = venueClock(new Date()).date
  const valid = week && /^\d{4}-\d{2}-\d{2}$/.test(week) && !Number.isNaN(Date.parse(week))
  const calendar = await managerCalendar(company.id, valid ? week : today, undefined)
  return (
    <>
      <h1 className="sr-only">Calendar</h1>
      <WeekCalendar calendar={calendar} thisWeek={mondayOf(today)} today={today} />
    </>
  )
}
