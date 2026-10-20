import type { Metadata } from 'next'
import { stepContext } from '@/lib/onboarding/page-guard'
import { ConnectButton } from '@/components/onboarding/ConnectButton'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('onboarding.refresh.title') }
}

/**
 * Where Stripe sends a manager who left its form unfinished (E09-09). The
 * button makes a fresh link to the same Stripe account.
 */
export default async function StripeRefreshPage() {
  await stepContext(4)
  const t = await getT()
  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold text-neutral-900">{t('onboarding.refresh.heading')}</h1>
      <p className="mt-2 text-neutral-700">{t('onboarding.refresh.body')}</p>
      <div className="mt-8">
        <ConnectButton label={t('onboarding.refresh.resume')} />
      </div>
    </div>
  )
}
