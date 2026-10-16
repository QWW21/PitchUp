import { redirect } from 'next/navigation'
import { auth } from '@/auth'

/**
 * Where "signed in" lands (the login form's default). Each role goes to its
 * own home: players to Discover, managers to their dashboard (which sends
 * an unfinished venue to onboarding), admins to venue approvals.
 */
export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fdashboard')
  if (session.user.role === 'PLAYER') redirect('/discover')
  if (session.user.role === 'ADMIN') redirect('/admin/companies')
  redirect('/manager/overview')
}
