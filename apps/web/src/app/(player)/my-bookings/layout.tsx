import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

/** My Bookings — E06-10. Signed-out visitors sign in first and come back here. */
export default async function MyBookingsLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent('/my-bookings')}`)
  return <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">{children}</main>
}
