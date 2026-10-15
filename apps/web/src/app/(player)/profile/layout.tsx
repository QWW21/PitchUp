import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { ProfileNav } from '@/components/profile/ProfileNav'

export const dynamic = 'force-dynamic'

/**
 * The player's profile — E08-08. A sidebar on wide screens, a scrolling row
 * of links on a phone. Signed-out visitors sign in first and come back.
 */
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent('/profile')}`)
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-16 pt-6 md:flex-row">
      <ProfileNav />
      <main className="min-w-0 max-w-[640px] flex-1">{children}</main>
    </div>
  )
}
