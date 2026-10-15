import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Dashboard | PitchUp' }

/** The manager's start page. The full dashboard is E09. */
export default async function DashboardPage() {
  // The layout redirects too, but layouts and pages render in parallel.
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=%2Fdashboard')
  const unanswered = await prisma.review.count({
    where: {
      deletedAt: null,
      moderationStatus: 'APPROVED',
      managerReply: null,
      pitch: { company: { ownerId: session.user.id } },
    },
  })

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
      <p className="mt-1 text-neutral-500">Signed in as {session.user.email}</p>
      <Link
        href="/dashboard/reviews?sort=unanswered"
        className="mt-6 flex max-w-sm items-center gap-3 rounded-xl bg-white p-4 shadow-sm hover:shadow-md"
      >
        <MessageSquare className="h-6 w-6 text-primary-600" aria-hidden="true" />
        <span>
          <span className="block font-semibold text-neutral-900">Reviews</span>
          <span className="text-sm text-neutral-700">
            {unanswered === 0
              ? 'Every review has a reply'
              : `${unanswered} ${unanswered === 1 ? 'review is' : 'reviews are'} waiting for a reply`}
          </span>
        </span>
      </Link>
    </>
  )
}
