import { redirect } from 'next/navigation'
import { onboardingContext } from '@/lib/onboarding/page-guard'

/** Picks up where the manager left off (E09-05). */
export default async function OnboardingStart() {
  const { company, status } = await onboardingContext()
  if (company?.status === 'PENDING') redirect('/onboarding/pending')
  redirect(`/onboarding/step/${status.currentStep ?? 1}`)
}
