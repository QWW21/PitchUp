import type { Metadata } from 'next'
import { stepContext } from '@/lib/onboarding/page-guard'
import { ConnectButton } from '@/components/onboarding/ConnectButton'

export const metadata: Metadata = { title: 'Finish payouts | PitchUp' }

/**
 * Where Stripe sends a manager who left its form unfinished (E09-09). The
 * button makes a fresh link to the same Stripe account.
 */
export default async function StripeRefreshPage() {
  await stepContext(4)
  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold text-neutral-900">Let&rsquo;s finish setting up payouts</h1>
      <p className="mt-2 text-neutral-700">
        Your Stripe account was created, but its setup isn&rsquo;t complete.
      </p>
      <div className="mt-8">
        <ConnectButton label="Resume Stripe setup" />
      </div>
    </div>
  )
}
