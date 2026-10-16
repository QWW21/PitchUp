import type { ReactNode } from 'react'
import { signOut } from '@/auth'
import { QueryProvider } from '@/components/QueryProvider'
import { ManagerShell } from '@/components/manager/ManagerShell'
import { requireActiveManager } from '@/lib/manager/access'

export const dynamic = 'force-dynamic'

/**
 * The manager dashboard — E09-10 (UIUX_SPEC §11): a dark sidebar, a top bar
 * and the page. Only for an approved venue's manager; everyone else is sent
 * where they belong (onboarding, review, Discover).
 */
export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const { session, company } = await requireActiveManager()

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <QueryProvider>
      <ManagerShell
        companyName={company.name}
        userName={session.user.name ?? session.user.email ?? 'Manager'}
        signOutAction={signOutAction}
      >
        {children}
      </ManagerShell>
    </QueryProvider>
  )
}
