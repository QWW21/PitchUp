import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import { trustTier, type ShirtColour } from '@pitchup/shared'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPitchDetail } from '@/lib/venues/pitch'
import { BookingShell } from '@/components/booking/BookingShell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Book a pitch | PitchUp' }

type Props = { children: ReactNode; params: Promise<{ pitchId: string }> }

/**
 * The booking flow — E05-10. Signed-out players sign in first and come back
 * to step 1; a pitch that cannot be booked, or a player whose trust tier
 * cannot book, goes back to the pitch page, which says why.
 */
export default async function BookingLayout({ children, params }: Props) {
  const { pitchId } = await params
  const session = await auth()
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/book/${pitchId}/date`)}`)
  }

  const pitch = await getPitchDetail(pitchId)
  if (!pitch) notFound()
  const pitchPath = `/discover/${pitch.company.id}/${pitch.id}`
  if (!pitch.isBookable) redirect(pitchPath)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { trustScore: true },
  })
  if (user && !trustTier(user.trustScore).canBook) redirect(pitchPath)

  return (
    <BookingShell
      pitch={{
        id: pitch.id,
        name: pitch.name,
        companyId: pitch.company.id,
        companyName: pitch.company.name,
        hourlyRate: pitch.hourlyRate,
        size: pitch.size,
        hasShirts: pitch.hasShirts,
        shirtStock: pitch.shirtInventory.map(s => ({
          colour: s.colour as ShirtColour,
          quantity: s.quantity,
        })),
        minBookingHours: pitch.minBookingHours,
        maxBookingHours: pitch.maxBookingHours,
        advanceBookingDays: pitch.advanceBookingDays,
      }}
    >
      {children}
    </BookingShell>
  )
}
