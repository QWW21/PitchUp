'use client'

/** Every notification, newest first, 20 at a time — E13-10's "See all". */
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { notificationWebPath, type NotificationItem, type NotificationPage } from '@pitchup/shared'
import { INTL_LOCALE } from '@pitchup/shared'
import { send } from '@/lib/http'
import { useLocale, useT } from '@/i18n/client'

export function NotificationHistory() {
  const t = useT()
  const stamp = new Intl.DateTimeFormat(INTL_LOCALE[useLocale()], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  })
  const router = useRouter()
  const queryClient = useQueryClient()
  const list = useInfiniteQuery({
    queryKey: ['notifications', 'all'],
    queryFn: ({ pageParam }) =>
      send<NotificationPage>(
        `/api/v1/notifications?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`,
        'GET'
      ),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
  })
  const items = list.data?.pages.flatMap(p => p.items) ?? []

  const openOne = async (n: NotificationItem) => {
    if (!n.isRead) await send(`/api/v1/notifications/${n.id}/read`, 'PATCH').catch(() => null)
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    router.push(notificationWebPath(n.type, n.data))
  }

  return (
    <section aria-labelledby="history-h" className="mt-6 rounded-xl bg-white p-5 shadow-sm">
      <h2 id="history-h" className="text-base font-semibold text-neutral-900">
        {t('profile.notifications.all')}
      </h2>
      {list.isLoading ? (
        <p className="mt-3 text-sm text-neutral-500">{t('profile.notifications.loading')}</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">{t('profile.notifications.none')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100">
          {items.map(n => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void openOne(n)}
                className={`block w-full rounded-md px-2 py-3 text-left hover:bg-neutral-50 ${n.isRead ? '' : 'bg-primary-50'}`}
              >
                <span
                  className={`block text-sm text-neutral-900 ${n.isRead ? '' : 'font-semibold'}`}
                >
                  {n.title}
                </span>
                <span className="block text-sm text-neutral-700">{n.body}</span>
                <span className="block text-xs text-neutral-500">
                  {stamp.format(new Date(n.createdAt))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.hasNextPage && (
        <button
          type="button"
          onClick={() => void list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
          className="mt-3 h-10 rounded-md border border-neutral-200 px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
        >
          {list.isFetchingNextPage
            ? t('profile.notifications.loading')
            : t('profile.notifications.more')}
        </button>
      )}
    </section>
  )
}
