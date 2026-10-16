/**
 * Who may see the manager area — E09-05. Done in the layout, not the Edge
 * middleware: it needs the database (the company's status), which the Edge
 * runtime cannot reach. The middleware only sends signed-out visitors to
 * the login page.
 */
import 'server-only'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { managerCompany, onboardingStatus } from '@/lib/onboarding/company'

/** The signed-in manager and their approved company; anyone else is redirected. */
export async function requireActiveManager() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fmanager%2Foverview')
  if (session.user.role === 'PLAYER') redirect('/discover')
  if (session.user.role === 'ADMIN') redirect('/admin/companies')
  const company = await managerCompany(session.user.id)
  if (company?.status === 'ACTIVE') return { session, company }
  if (company?.status === 'SUSPENDED') redirect('/manager/suspended')
  if (company?.status === 'PENDING') redirect('/onboarding/pending')
  redirect(`/onboarding/step/${onboardingStatus(company).currentStep ?? 1}`)
}
