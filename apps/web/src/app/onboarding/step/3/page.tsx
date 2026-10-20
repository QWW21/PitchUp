import type { Metadata } from 'next'
import { DEFAULT_ONBOARDING_HOURS, normalizeWeek } from '@pitchup/shared'
import { stepContext } from '@/lib/onboarding/page-guard'
import { getT } from '@/i18n/server'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { ContactHoursForm } from '@/components/onboarding/ContactHoursForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('onboarding.step3.title') }
}

/** Onboarding step 3 — E09-08. */
export default async function Step3() {
  const { company, status } = await stepContext(3)
  const t = await getT()
  const c = company!
  return (
    <>
      <StepHeader
        step={3}
        status={status}
        title={t('onboarding.step3.heading')}
        intro={t('onboarding.step3.intro')}
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
