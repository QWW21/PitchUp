import type { Metadata } from 'next'
import { stepContext } from '@/lib/onboarding/page-guard'
import { getT } from '@/i18n/server'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { CompanyInfoForm } from '@/components/onboarding/CompanyInfoForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('onboarding.step1.title') }
}

/** Onboarding step 1 — E09-06, PRD §8.1. */
export default async function Step1() {
  const { session, company, status } = await stepContext(1)
  const t = await getT()
  return (
    <>
      <StepHeader
        step={1}
        status={status}
        title={t('onboarding.step1.heading')}
        intro={t('onboarding.step1.intro')}
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
