import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/AdminNav'

export const dynamic = 'force-dynamic'

/**
 * The admin panel — E15-06: a dark sidebar (as in the manager area) with
 * counts of what waits for an admin. Admins only; anyone else is sent home.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fadmin')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const [pending, changes, disputes] = await Promise.all([
    prisma.company.count({ where: { status: 'PENDING' } }),
    prisma.company.count({ where: { status: 'ACTIVE', changesSubmittedAt: { not: null } } }),
    prisma.noShow.count({ where: { disputeStatus: 'OPEN' } }),
  ])

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <div className="min-h-screen bg-neutral-50 lg:flex">
      <aside className="bg-neutral-900 px-3 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-[220px] lg:shrink-0 lg:py-5">
        <div className="mb-3 flex items-center gap-2 px-2 lg:mb-6">
          <Link href="/admin" className="text-lg font-bold text-white">
            PitchUp
          </Link>
          <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white">
            Admin
          </span>
          <form action={signOutAction} className="ml-auto lg:hidden">
            <button type="submit" className="text-sm font-medium text-neutral-300 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
        <AdminNav alerts={{ '/admin/companies': pending + changes, '/admin/disputes': disputes }} />
        <form action={signOutAction} className="mt-6 hidden px-2 lg:block">
          <button type="submit" className="text-sm font-medium text-neutral-300 hover:text-white">
            Sign out
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-16 pt-6 lg:px-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
