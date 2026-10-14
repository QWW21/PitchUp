import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  // The dashboard is the manager area. Players who sign in on the web
  // belong on Discover (PRD §5.3), not on a page with nothing for them.
  if (session.user.role === 'PLAYER') redirect('/discover')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
      <p className="text-neutral-500">Signed in as {session.user.email}</p>
      <form
        action={async () => {
          'use server'
          await signOut({ redirectTo: '/login' })
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
