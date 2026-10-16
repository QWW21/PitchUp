import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'

export const dynamic = 'force-dynamic'

/** The admin area — for now only venue approvals (E09); E15 builds the full panel. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fadmin%2Fcompanies')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Link href="/admin/companies" className="text-xl font-bold text-primary-600">
            PitchUp
          </Link>
          <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-semibold text-white">
            Admin
          </span>
          <form action={signOutAction} className="ml-auto">
            <button
              type="submit"
              className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">{children}</main>
    </>
  )
}
