import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Info } from 'lucide-react'
import { stepContext } from '@/lib/onboarding/page-guard'
import { getT } from '@/i18n/server'
import { isStripeConfigured } from '@/lib/payments/stripe'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { ConnectButton } from '@/components/onboarding/ConnectButton'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('onboarding.step4.title') }
}

/** Onboarding step 4 — E09-09, PRD §8.6. */
export default async function Step4() {
  const { status } = await stepContext(4)
  const t = await getT()
  const testMode = !isStripeConfigured()
  const benefits = ([0, 1, 2] as const).map(i => t(`onboarding.step4.benefits.${i}`))
  return (
    <>
      <StepHeader
        step={4}
        status={status}
        title={t('onboarding.step4.heading')}
        intro={t('onboarding.step4.intro')}
      />
      <div className="mt-6 flex gap-3 rounded-r-md border-l-[3px] border-info-500 bg-info-50 p-4 text-sm text-neutral-900">
        <Info className="h-5 w-5 shrink-0 text-info-500" aria-hidden="true" />
        <div className="space-y-1">
          <p>{t('onboarding.step4.stripe1')}</p>
          <p>{t('onboarding.step4.stripe2')}</p>
          <p>{t('onboarding.step4.stripe3')}</p>
        </div>
      </div>
      <ul className="mt-6 space-y-2">
        {benefits.map(b => (
          <li key={b} className="flex items-center gap-2 text-neutral-700">
            <CheckCircle2 className="h-5 w-5 text-primary-600" aria-hidden="true" />
            {b}
          </li>
        ))}
      </ul>
      {testMode && (
        <p className="mt-6 rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
          {t('onboarding.step4.testMode')}
        </p>
      )}
      <div className="mt-6 space-y-3">
        <ConnectButton label={t('onboarding.step4.connect')} />
        <Link
          href="/onboarding/step/3"
          className="block text-center text-sm font-medium text-neutral-700 hover:underline"
        >
          {t('onboarding.step4.back')}
        </Link>
      </div>
    </>
  )
}
