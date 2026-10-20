import type { Metadata } from 'next'
import { stepContext } from '@/lib/onboarding/page-guard'
import { getT } from '@/i18n/server'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { LocationForm } from '@/components/onboarding/LocationForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('onboarding.step2.title') }
}

/** Onboarding step 2 — E09-07. */
export default async function Step2() {
  const { company, status } = await stepContext(2)
  const t = await getT()
  const c = company!
  return (
    <>
      <StepHeader
        step={2}
        status={status}
        title={t('onboarding.step2.heading')}
        intro={t('onboarding.step2.intro')}
      />
      <LocationForm
        existing={{
          addressLine1: c.addressLine1 ?? '',
          addressLine2: c.addressLine2 ?? '',
          city: c.city ?? '',
          county: c.county ?? '',
          postalCode: c.postalCode ?? '',
          lat: c.lat,
          lng: c.lng,
        }}
      />
    </>
  )
}
