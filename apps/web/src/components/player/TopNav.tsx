import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { UserMenu } from './UserMenu'

export async function TopNav() {
  const session = await auth()

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/discover' })
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] print:hidden">
      <nav className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 lg:px-6">
        <Link href="/discover" className="text-xl font-bold text-primary-600">
          PitchUp
        </Link>
        {session?.user ? (
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu
              name={session.user.name ?? session.user.email ?? 'Account'}
              isManager={session.user.role !== 'PLAYER'}
              signOutAction={signOutAction}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              // No callbackUrl: after signing in, players land on Discover and
              // managers on their dashboard (/dashboard sends players on).
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Register
            </Link>
          </div>
        )}
      </nav>
    </header>
  )
}
