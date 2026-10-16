import type { Metadata } from 'next'
import { stepContext } from '@/lib/onboarding/page-guard'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { CompanyInfoForm } from '@/components/onboarding/CompanyInfoForm'

export const metadata: Metadata = { title: 'Company info | PitchUp' }

/** Onboarding step 1 — E09-06, PRD §8.1. */
export default async function Step1() {
  const { session, company, status } = await stepContext(1)
  return (
    <>
      <StepHeader
        step={1}
        status={status}
        title="Tell players about your venue"
        intro="This is what players see on your page. You can change it later."
      />
      <CompanyInfoForm
        // The logo is stored under the company once it exists, under the manager before.
        ownerId={company?.id ?? session.user.id}
        existing={
          company
            ? {
                name: company.name,
                description: company.description ?? '',
                logoUrl: company.logoUrl,
                websiteUrl: company.websiteUrl ?? '',
                facebookUrl: company.facebookUrl ?? '',
                instagramUrl: company.instagramUrl ?? '',
              }
            : null
        }
        uploadsEnabled={!!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
      />
    </>
  )
}
