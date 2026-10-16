import type { Metadata } from 'next'
import { stepContext } from '@/lib/onboarding/page-guard'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { LocationForm } from '@/components/onboarding/LocationForm'

export const metadata: Metadata = { title: 'Location | PitchUp' }

/** Onboarding step 2 — E09-07. */
export default async function Step2() {
  const { company, status } = await stepContext(2)
  const c = company!
  return (
    <>
      <StepHeader
        step={2}
        status={status}
        title="Where is it?"
        intro="Players find you on the map by this address. Drag the pin if it isn't quite right."
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
