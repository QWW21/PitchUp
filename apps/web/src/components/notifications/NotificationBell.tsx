'use client'

/**
 * The bell — E13-10, shared by the player header and the manager's top bar.
 * The unread count refreshes every 30 seconds; opening it shows the latest
 * five, read or not. A row opens what it is about and marks it read.
 * Escape and a click outside close it.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationWebPath, type NotificationItem, type NotificationPage } from '@pitchup/shared'
import { send } from '@/lib/http'

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.round(hours / 24)} d ago`
}

export function NotificationBell() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => send<{ unread: number }>('/api/v1/notifications/count', 'GET'),
    refetchInterval: 30_000,
  })
  const latest = useQuery({
    queryKey: ['notifications', 'latest'],
    queryFn: () => send<NotificationPage>('/api/v1/notifications?limit=5', 'GET'),
    enabled: open,
  })
  const unread = count.data?.unread ?? 0
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] })

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const readAll = async () => {
    await send('/api/v1/notifications/read-all', 'PATCH')
    refresh()
  }
  const openOne = async (n: NotificationItem) => {
    setOpen(false)
    if (!n.isRead) await send(`/api/v1/notifications/${n.id}/read`, 'PATCH').catch(() => null)
    refresh()
    router.push(notificationWebPath(n.type, n.data))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2">
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void readAll()}
                className="text-xs font-medium text-primary-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {latest.data?.items.length ? (
            <ul className="max-h-80 overflow-y-auto">
              {latest.data.items.map(n => (
                <li key={n.id} className="border-b border-neutral-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => void openOne(n)}
                    className={`block w-full px-4 py-2 text-left hover:bg-neutral-50 ${n.isRead ? '' : 'bg-primary-50'}`}
                  >
                    <span
                      className={`block text-sm text-neutral-900 ${n.isRead ? '' : 'font-semibold'}`}
                    >
                      {n.title}
                    </span>
                    <span className="line-clamp-2 block text-xs text-neutral-700">{n.body}</span>
                    <span className="block text-[11px] text-neutral-500">{ago(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">
              {latest.isLoading ? 'Loading…' : 'You’re all caught up'}
            </p>
          )}
          <Link
            href="/profile/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-neutral-100 px-4 py-2 text-center text-sm font-medium text-primary-700 hover:bg-neutral-50"
          >
            All notifications and settings
          </Link>
        </div>
      )}
    </div>
  )
}
