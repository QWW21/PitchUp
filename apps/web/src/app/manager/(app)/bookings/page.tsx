import type { Metadata } from 'next'
import { ManagerBookingQuerySchema } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { requireActiveManager } from '@/lib/manager/access'
import { listManagerBookings } from '@/lib/manager/bookings'
import { BookingList } from '@/components/manager/BookingList'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('mBookings.list.title') }
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * The venue's bookings — E11-06: filters kept in the URL (so a filtered list
 * can be shared or bookmarked), pages of 20, CSV export. Rendered on the
 * server; more pages and exports are fetched by the browser.
 */
export default async function BookingsPage({ searchParams }: Props) {
  const { company } = await requireActiveManager()
  const t = await getT()
  const raw = await searchParams
  const params = Object.fromEntries(
    Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1])
  )
  // A hand-edited URL with a bad filter shows everything rather than an error.
  const parsed = ManagerBookingQuerySchema.safeParse({ ...params, cursor: undefined })
  const query = parsed.success ? parsed.data : ManagerBookingQuerySchema.parse({})
  const [page, pitches] = await Promise.all([
    listManagerBookings(company.id, query),
    prisma.pitch.findMany({
      where: { companyId: company.id, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])
  return (
    <>
      <h1 className="sr-only">{t('mBookings.list.heading')}</h1>
      <BookingList
        key={JSON.stringify(params)}
        initial={page}
        pitches={pitches}
        filters={parsed.success ? params : {}}
      />
    </>
  )
}
