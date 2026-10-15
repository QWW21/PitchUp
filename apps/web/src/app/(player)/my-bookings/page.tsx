import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MyBookings } from '@/components/bookings/MyBookings'

export const metadata: Metadata = { title: 'My bookings | PitchUp' }

export default function MyBookingsPage() {
  return (
    <Suspense>
      <MyBookings />
    </Suspense>
  )
}
