import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Hourglass } from 'lucide-react'
import { onboardingContext } from '@/lib/onboarding/page-guard'
import { getT } from '@/i18n/server'
import { MARK, withMarkup } from '@/i18n/rich'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('onboarding.pending.title') }
}

/** After onboarding — E09-09. An approved venue goes on to its dashboard. */
export default async function PendingPage() {
  const { company, status } = await onboardingContext()
  if (company?.status !== 'PENDING') redirect(`/onboarding/step/${status.currentStep ?? 1}`)
  const t = await getT()
  return (
    <div className="flex flex-col items-center text-center">
      <Hourglass className="h-20 w-20 text-primary-600" aria-hidden="true" />
      <h1 className="mt-6 text-3xl font-bold text-neutral-900">
        {t('onboarding.pending.heading')}
      </h1>
      <p className="mt-3 text-neutral-700">
        {withMarkup(
          t('onboarding.pending.pending', { name: MARK }),
          <strong>{company.name}</strong>
        )}
      </p>
      <p className="mt-1 text-neutral-500">{t('onboarding.pending.email')}</p>
      <section
        aria-labelledby="meanwhile"
        className="mt-8 w-full rounded-xl bg-white p-5 text-left shadow-sm"
      >
        <h2 id="meanwhile" className="font-semibold text-neutral-900">
          {t('onboarding.pending.meanwhile')}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>{t('onboarding.pending.once')}</li>
          <li>
            {withMarkup(
              t('onboarding.pending.change', { link: MARK }),
              <Link href="/onboarding/step/1" className="font-medium text-primary-700 underline">
                {t('onboarding.pending.edit')}
              </Link>
            )}
          </li>
        </ul>
      </section>
      <p className="mt-6 text-sm text-neutral-500">
        {t('onboarding.pending.help')}{' '}
        <a href="mailto:support@pitchup.ro" className="font-medium text-primary-700 underline">
          support@pitchup.ro
        </a>
      </p>
    </div>
  )
}
