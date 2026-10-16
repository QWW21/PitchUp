import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Hourglass } from 'lucide-react'
import { onboardingContext } from '@/lib/onboarding/page-guard'

export const metadata: Metadata = { title: 'Under review | PitchUp' }

/** After onboarding — E09-09. An approved venue goes on to its dashboard. */
export default async function PendingPage() {
  const { company, status } = await onboardingContext()
  if (company?.status !== 'PENDING') redirect(`/onboarding/step/${status.currentStep ?? 1}`)
  return (
    <div className="flex flex-col items-center text-center">
      <Hourglass className="h-20 w-20 text-primary-600" aria-hidden="true" />
      <h1 className="mt-6 text-3xl font-bold text-neutral-900">Your company is under review</h1>
      <p className="mt-3 text-neutral-700">
        <strong>{company.name}</strong> is pending approval.
      </p>
      <p className="mt-1 text-neutral-500">
        We&rsquo;ll email you once it&rsquo;s approved. This usually takes 1–2 business days.
      </p>
      <section
        aria-labelledby="meanwhile"
        className="mt-8 w-full rounded-xl bg-white p-5 text-left shadow-sm"
      >
        <h2 id="meanwhile" className="font-semibold text-neutral-900">
          While you wait
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>
            Once approved, you&rsquo;ll add your pitches and prices from your dashboard, and
            bookings can start.
          </li>
          <li>
            Something to change?{' '}
            <Link href="/onboarding/step/1" className="font-medium text-primary-700 underline">
              Edit your details
            </Link>
            .
          </li>
        </ul>
      </section>
      <p className="mt-6 text-sm text-neutral-500">
        Need help?{' '}
        <a href="mailto:support@pitchup.ro" className="font-medium text-primary-700 underline">
          support@pitchup.ro
        </a>
      </p>
    </div>
  )
}
