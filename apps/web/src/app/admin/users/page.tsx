import type { Metadata } from 'next'
import Link from 'next/link'
import { AdminUserQuerySchema } from '@pitchup/shared'
import { listUsers } from '@/lib/admin/users'
import { UserFilters } from '@/components/admin/UserFilters'
import { INTL_LOCALE } from '@pitchup/shared'
import { getLocale, getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('admin.users.title') }
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const ROLE_STYLE: Record<string, string> = {
  PLAYER: 'bg-neutral-100 text-neutral-700',
  MANAGER: 'bg-info-50 text-blue-800',
  ADMIN: 'bg-neutral-900 text-white',
}

/** Every account — E15-07: search, filters in the URL, pages of 20. */
export default async function AdminUsersPage({ searchParams }: Props) {
  const raw = await searchParams
  const t = await getT()
  const joined = new Intl.DateTimeFormat(INTL_LOCALE[await getLocale()], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  })
  const pick = (k: string) =>
    typeof raw[k] === 'string' && raw[k] ? (raw[k] as string) : undefined
  const parsed = AdminUserQuerySchema.safeParse({
    search: pick('search'),
    role: pick('role'),
    tier: pick('tier'),
    status: pick('status'),
    cursor: pick('cursor'),
  })
  const query = parsed.success ? parsed.data : AdminUserQuerySchema.parse({})
  const page = await listUsers(query)
  const next = new URLSearchParams(
    Object.entries({ ...query, cursor: page.nextCursor ?? '', limit: '' }).filter(
      (e): e is [string, string] => typeof e[1] === 'string' && !!e[1]
    )
  )

  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">{t('admin.users.heading')}</h1>
      <UserFilters
        search={query.search ?? ''}
        role={query.role ?? ''}
        tier={query.tier ?? ''}
        status={query.status ?? ''}
      />
      {page.items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-700">{t('admin.users.none')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs text-neutral-700">
              <tr>
                {(['user', 'role', 'trust', 'bookings', 'status', 'joined'] as const).map(h => (
                  <th key={h} scope="col" className="px-4 py-2 font-medium">
                    {t(`admin.users.cols.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {page.items.map(u => (
                <tr key={u.id}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-primary-700 hover:underline"
                    >
                      {u.name}
                    </Link>
                    <span className="block max-w-[16rem] truncate text-xs font-normal text-neutral-500">
                      {u.email}
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLE[u.role]}`}
                    >
                      {t(`admin.users.role.${u.role as 'PLAYER' | 'MANAGER' | 'ADMIN'}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {u.trustScore}{' '}
                    <span className="text-xs text-neutral-500">{t(`trust.tier.${u.tier}`)}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{u.bookings}</td>
                  <td className="px-4 py-3">
                    {u.deletedAt ? (
                      <span className="text-xs text-neutral-500">{t('admin.users.deleted')}</span>
                    ) : u.suspendedAt ? (
                      <span className="rounded-full bg-error-50 px-2 py-0.5 text-xs font-medium text-error-600">
                        {t('admin.users.suspended')}
                      </span>
                    ) : (
                      <span className="text-xs text-primary-700">{t('admin.users.active')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {joined.format(new Date(u.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page.nextCursor && (
        <Link
          href={`/admin/users?${next}`}
          className="mt-4 inline-flex h-10 items-center rounded-md border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
        >
          {t('admin.nextPage')}
        </Link>
      )}
    </>
  )
}
