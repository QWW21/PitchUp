import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { QueryProvider } from '@/components/QueryProvider'
import { DashboardNav } from '@/components/manager/DashboardNav'

export const dynamic = 'force-dynamic'

/**
 * The manager area. A header with the sections built so far; E09 grows it
 * into the full dashboard with a sidebar (UIUX_SPEC §13).
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fdashboard')
  // Players who sign in on the web belong on Discover (PRD §5.3).
  if (session.user.role === 'PLAYER') redirect('/discover')

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <QueryProvider>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4 sm:gap-6">
          <Link href="/dashboard" className="text-lg font-bold text-primary-600 sm:text-xl">
            PitchUp
          </Link>
          <DashboardNav />
          <div className="ml-auto">
            <form action={signOutAction}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-lg bg-neutral-100 px-2 py-2 text-sm sm:px-3 font-medium text-neutral-700 hover:bg-neutral-200"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">{children}</main>
    </QueryProvider>
  )
}
