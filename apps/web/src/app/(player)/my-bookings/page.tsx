import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MyBookings } from '@/components/bookings/MyBookings'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('myBookings.title') }
}

export default function MyBookingsPage() {
  return (
    <Suspense>
      <MyBookings />
    </Suspense>
  )
}
