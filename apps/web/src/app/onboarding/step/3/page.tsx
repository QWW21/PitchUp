import type { Metadata } from 'next'
import { DEFAULT_ONBOARDING_HOURS, normalizeWeek } from '@pitchup/shared'
import { stepContext } from '@/lib/onboarding/page-guard'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { ContactHoursForm } from '@/components/onboarding/ContactHoursForm'

export const metadata: Metadata = { title: 'Contact & hours | PitchUp' }

/** Onboarding step 3 — E09-08. */
export default async function Step3() {
  const { company, status } = await stepContext(3)
  const c = company!
  return (
    <>
      <StepHeader
        step={3}
        status={status}
        title="Contact and opening hours"
        intro="Players see these on your page, and can only book while you're open."
      />
      <ContactHoursForm
        existing={{
          phone: c.phone ?? '',
          email: c.email ?? '',
          hours: c.workingHours ? normalizeWeek(c.workingHours) : DEFAULT_ONBOARDING_HOURS,
        }}
      />
    </>
  )
}
