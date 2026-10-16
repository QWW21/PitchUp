/**
 * Who may see onboarding pages, and which step they may be on (E09-05).
 * Signed-in venue managers only; an approved venue goes to its dashboard;
 * a step later than the next one to do sends the manager back to it.
 */
import 'server-only'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { managerCompany, onboardingStatus } from './company'

export async function onboardingContext() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fonboarding')
  if (session.user.role !== 'MANAGER') redirect('/dashboard')
  const company = await managerCompany(session.user.id)
  if (company?.status === 'ACTIVE') redirect('/manager/overview')
  if (company?.status === 'SUSPENDED') redirect('/manager/suspended')
  return { session, company, status: onboardingStatus(company) }
}

/** For step pages: a submitted venue may still fix steps 1–3, not redo step 4. */
export async function stepContext(step: 1 | 2 | 3 | 4) {
  const ctx = await onboardingContext()
  const next = ctx.status.currentStep
  if (next !== null && step > next) redirect(`/onboarding/step/${next}`)
  if (ctx.company?.status === 'PENDING' && step === 4) redirect('/onboarding/pending')
  return ctx
}
