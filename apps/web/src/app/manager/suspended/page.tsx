import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PauseCircle } from 'lucide-react'
import { auth } from '@/auth'
import { managerCompany } from '@/lib/onboarding/company'

export const metadata: Metadata = { title: 'Venue suspended | PitchUp' }

/** Where a suspended venue's manager lands (E09-05). Suspending is an admin action (E15). */
export default async function SuspendedPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const company = await managerCompany(session.user.id)
  if (company?.status !== 'SUSPENDED') redirect('/manager/overview')
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <PauseCircle className="h-16 w-16 text-neutral-400" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-neutral-900">{company.name} is suspended</h1>
      <p className="mt-2 text-neutral-700">
        It is hidden from players and takes no bookings. Write to{' '}
        <a href="mailto:support@pitchup.ro" className="font-medium text-primary-700 underline">
          support@pitchup.ro
        </a>{' '}
        to find out why and what to do.
      </p>
    </main>
  )
}
