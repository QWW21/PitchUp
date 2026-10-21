/**
 * The manager hears on every page when the venue isn't live, or soon won't
 * be — C-15: not subscribed, in a free month without a card, a failed
 * payment, or paused. Nothing while all is well.
 */
import Link from 'next/link'
import type { Company } from '@prisma/client'
import { BILLING_GRACE_DAYS, formatDateLong } from '@pitchup/shared'
import { getLocale, getT } from '@/i18n/server'

type Billing = Pick<
  Company,
  'subscriptionStatus' | 'billingInterval' | 'trialEndsAt' | 'subscriptionPastDueSince'
>

export async function BillingBanner({ company }: { company: Billing }) {
  const [t, locale] = await Promise.all([getT(), getLocale()])
  const date = (d: Date) => formatDateLong(d.toISOString().slice(0, 10), locale)
  const s = company.subscriptionStatus
  const message =
    s === 'NONE'
      ? t('manager.billing.banner.NONE')
      : s === 'PAUSED'
        ? t('manager.billing.banner.PAUSED')
        : s === 'PAST_DUE' && company.subscriptionPastDueSince
          ? t('manager.billing.banner.PAST_DUE', {
              date: date(
                new Date(
                  company.subscriptionPastDueSince.getTime() + BILLING_GRACE_DAYS * 86_400_000
                )
              ),
            })
          : s === 'TRIALING' && !company.billingInterval && company.trialEndsAt
            ? t('manager.billing.banner.trialNoCard', { date: date(company.trialEndsAt) })
            : null
  if (!message) return null
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-500 bg-warning-50 px-4 py-3 text-sm text-neutral-900"
    >
      <span>{message}</span>
      <Link
        href="/manager/settings/billing"
        className="font-semibold text-primary-700 underline hover:text-primary-600"
      >
        {t('manager.billing.banner.action')}
      </Link>
    </div>
  )
}
