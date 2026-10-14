import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

type Props = { searchParams: Promise<{ pitchId?: string; date?: string }> }

/**
 * Where Book Now lands until the booking flow is built (E05). Signed-out
 * visitors are sent to sign in and brought back here.
 */
export default async function NewBookingPlaceholder({ searchParams }: Props) {
  const { pitchId, date } = await searchParams
  const session = await auth()
  if (!session?.user) {
    const back = `/booking/new?pitchId=${pitchId ?? ''}${date ? `&date=${date}` : ''}`
    redirect(`/login?callbackUrl=${encodeURIComponent(back)}`)
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">Booking is coming soon</h1>
      <p className="mt-2 text-sm text-neutral-500">
        The booking flow is built in E05.{date ? ` You picked ${date}.` : ''}
      </p>
      <Link
        href="/discover"
        className="mt-6 inline-block text-sm font-medium text-primary-600 hover:underline"
      >
        Back to Discover
      </Link>
    </main>
  )
}
