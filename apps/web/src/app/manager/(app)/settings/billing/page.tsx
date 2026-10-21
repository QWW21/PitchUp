import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { getBilling } from '@/lib/billing'
import { SubscriptionPanel } from '@/components/manager/SubscriptionPanel'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('manager.billing.title') }
}

export const dynamic = 'force-dynamic'

/** The venue's subscription to PitchUp — C-15. */
export default async function BillingPage() {
  const { company } = await requireActiveManager()
  return <SubscriptionPanel initial={await getBilling(company.id)} />
}
