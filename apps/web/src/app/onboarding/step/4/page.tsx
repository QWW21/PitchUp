import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Info } from 'lucide-react'
import { stepContext } from '@/lib/onboarding/page-guard'
import { isStripeConfigured } from '@/lib/payments/stripe'
import { StepHeader } from '@/components/onboarding/StepHeader'
import { ConnectButton } from '@/components/onboarding/ConnectButton'

export const metadata: Metadata = { title: 'Payouts | PitchUp' }

const BENEFITS = [
  'Receive payments directly from bookings',
  'Automatic payouts after each completed booking',
  'Secure identity verification by Stripe',
]

/** Onboarding step 4 — E09-09, PRD §8.6. */
export default async function Step4() {
  const { status } = await stepContext(4)
  const testMode = !isStripeConfigured()
  return (
    <>
      <StepHeader
        step={4}
        status={status}
        title="Set up payouts"
        intro="The last step. After it, we review your venue, usually within 1–2 business days."
      />
      <div className="mt-6 flex gap-3 rounded-r-md border-l-[3px] border-info-500 bg-info-50 p-4 text-sm text-neutral-900">
        <Info className="h-5 w-5 shrink-0 text-info-500" aria-hidden="true" />
        <div className="space-y-1">
          <p>PitchUp uses Stripe to process payments and pay you out.</p>
          <p>You&rsquo;ll need to provide your business details and bank account.</p>
          <p>This is handled securely by Stripe. PitchUp never sees your bank details.</p>
        </div>
      </div>
      <ul className="mt-6 space-y-2">
        {BENEFITS.map(b => (
          <li key={b} className="flex items-center gap-2 text-neutral-700">
            <CheckCircle2 className="h-5 w-5 text-primary-600" aria-hidden="true" />
            {b}
          </li>
        ))}
      </ul>
      {testMode && (
        <p className="mt-6 rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
          Test mode: Stripe isn&rsquo;t set up on this server, so this step completes without it.
        </p>
      )}
      <div className="mt-6 space-y-3">
        <ConnectButton label="Connect with Stripe" />
        <Link
          href="/onboarding/step/3"
          className="block text-center text-sm font-medium text-neutral-700 hover:underline"
        >
          Back to contact &amp; hours
        </Link>
      </div>
    </>
  )
}
