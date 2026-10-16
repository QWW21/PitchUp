import type { ReactNode } from 'react'
import Link from 'next/link'
import { signOut } from '@/auth'
import { QueryProvider } from '@/components/QueryProvider'

export const dynamic = 'force-dynamic'

/** The onboarding wizard's frame — E09-06 (UIUX_SPEC §12.2): a slim header, a centred column. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/login' })
  }
  return (
    <QueryProvider>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/onboarding" className="text-xl font-bold text-primary-600">
            PitchUp
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-[640px] px-4 py-12">{children}</main>
    </QueryProvider>
  )
}
