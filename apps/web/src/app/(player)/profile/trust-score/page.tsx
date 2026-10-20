import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { auth } from '@/auth'
import { getTrustScore } from '@/lib/profile/account'
import { TrustScoreRing } from '@/components/profile/TrustScoreRing'
import { TrustHistory } from '@/components/profile/TrustHistory'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('profile.trust.title') }
}

/**
 * Trust score — E08-08 (UIUX_SPEC §10.2 for the web): the ring, what the
 * tier allows, every tier, tips, and the history (first page rendered here,
 * the rest loads as you scroll).
 */
export default async function TrustScorePage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fprofile%2Ftrust-score')
  const s = await getTrustScore(session.user.id, undefined)
  const t = await getT()
  const tips = ([0, 1, 2, 3] as const).map(i => t(`profile.trust.tips.${i}`))

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('profile.trust.heading')}</h1>

      <section className="mt-4 flex flex-col items-center rounded-xl bg-white p-6 text-center shadow-sm">
        <TrustScoreRing score={s.score} />
        <p className="mt-2 text-lg font-semibold text-neutral-900">{t(`trust.tier.${s.tier}`)}</p>
        <p className="text-sm text-neutral-700">{s.tierDescription}</p>
      </section>

      <section aria-labelledby="tiers-heading" className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 id="tiers-heading" className="font-semibold text-neutral-900">
          {t('profile.trust.tiers')}
        </h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="sr-only">
            <tr>
              <th scope="col">{t('profile.trust.tier')}</th>
              <th scope="col">{t('profile.trust.score')}</th>
              <th scope="col">{t('profile.trust.meaning')}</th>
            </tr>
          </thead>
          <tbody>
            {s.tiers.map(row => {
              const current = row.name === s.tier
              return (
                <tr
                  key={row.name}
                  aria-current={current ? 'true' : undefined}
                  className={current ? 'bg-neutral-50' : ''}
                >
                  <th
                    scope="row"
                    className="border-l-[3px] py-2 pl-2 pr-2 font-medium text-neutral-900"
                    style={{ borderLeftColor: current ? row.colour : 'transparent' }}
                  >
                    {t(`trust.tier.${row.name}`)}
                    {current && <span className="sr-only">{t('profile.trust.yours')}</span>}
                  </th>
                  <td className="whitespace-nowrap py-2 pr-2 text-neutral-500">{row.range}</td>
                  <td className="py-2 text-neutral-700">{row.description}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="history-heading" className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 id="history-heading" className="font-semibold text-neutral-900">
          {t('profile.trust.history')}
        </h2>
        <TrustHistory initial={s.events} nextCursor={s.nextCursor} />
      </section>

      <section aria-labelledby="tips-heading" className="mt-4 rounded-xl bg-neutral-100 p-4">
        <h2 id="tips-heading" className="font-semibold text-neutral-900">
          {t('profile.trust.improve')}
        </h2>
        <ul className="mt-2 space-y-2">
          {tips.map(tip => (
            <li key={tip} className="flex items-center gap-2 text-sm text-neutral-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
              {tip}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
