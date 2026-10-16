'use client'

/**
 * The manager dashboard's frame — E09-10 (UIUX_SPEC §11): a dark sidebar,
 * a top bar with the page title, notifications and the account menu.
 *
 * - wider than 1024 px: the full 240 px sidebar, which can be collapsed to
 *   icons (remembered in this browser);
 * - 768–1024 px: icons only;
 * - narrower: no sidebar; the menu button opens it as a drawer.
 *
 * Sections built in later epics show as "Soon" rather than as dead links.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  List,
  Menu,
  Settings,
  Star,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { NotificationPage } from '@pitchup/shared'
import { send } from '@/lib/http'

interface Item {
  label: string
  icon: LucideIcon
  href?: string
}
const SECTIONS: { title?: string; items: Item[] }[] = [
  {
    items: [
      { label: 'Overview', icon: Home, href: '/manager/overview' },
      { label: 'Calendar', icon: CalendarDays },
      { label: 'Bookings', icon: List, href: '/manager/bookings' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Pitches', icon: Trophy, href: '/manager/pitches' },
      { label: 'Reviews', icon: Star, href: '/manager/reviews' },
    ],
  },
  { title: 'Business', items: [{ label: 'Analytics', icon: BarChart3 }] },
  { title: 'Account', items: [{ label: 'Settings', icon: Settings, href: '/manager/settings' }] },
]

const TITLES: Record<string, string> = {
  '/manager/overview': 'Overview',
  '/manager/reviews': 'Reviews',
  '/manager/bookings': 'Bookings',
  '/manager/settings': 'Settings',
  '/manager/pitches': 'Pitches',
}

/** The section a path belongs to: /manager/pitches/abc/edit is under Pitches. */
const sectionOf = (pathname: string) =>
  Object.keys(TITLES).find(p => pathname === p || pathname.startsWith(`${p}/`))

const COLLAPSED_KEY = 'pitchup:manager-sidebar-collapsed'

export function ManagerShell({
  companyName,
  userName,
  signOutAction,
  children,
}: {
  companyName: string
  userName: string
  signOutAction: () => Promise<void>
  children: ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)

  // Remembered per browser; storage can be blocked, which just means "expanded".
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1')
    } catch {
      // Blocked storage: stay expanded.
    }
  }, [])
  const toggle = () =>
    setCollapsed(c => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // Blocked storage: the choice lasts until the page reloads.
      }
      return !c
    })

  // A link in the drawer closes it.
  useEffect(() => setDrawer(false), [pathname])

  return (
    <div className="min-h-screen bg-neutral-50 md:flex">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-neutral-900 md:flex md:w-16 ${
          collapsed ? 'lg:w-16' : 'lg:w-60'
        }`}
      >
        <Sidebar
          pathname={pathname}
          compact="tablet"
          collapsed={collapsed}
          userName={userName}
          onToggle={toggle}
        />
      </aside>

      {drawer && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-label="Menu"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-neutral-900">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
              className="absolute right-2 top-4 rounded-md p-2 text-neutral-400 hover:bg-neutral-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <Sidebar pathname={pathname} compact={false} collapsed={false} userName={userName} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-neutral-200 bg-white px-4">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100 md:hidden"
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-neutral-900">
              {TITLES[sectionOf(pathname) ?? ''] ?? 'Dashboard'}
            </p>
            <p className="truncate text-xs text-neutral-500">{companyName}</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Notifications />
            <AccountMenu userName={userName} signOutAction={signOutAction} />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">{children}</main>
      </div>
    </div>
  )
}

function Sidebar({
  pathname,
  compact,
  collapsed,
  userName,
  onToggle,
}: {
  pathname: string
  /** "tablet": icons only between 768 and 1024 px. */
  compact: 'tablet' | false
  collapsed: boolean
  userName: string
  onToggle?: () => void
}) {
  // Labels show on a phone drawer, and on desktop unless collapsed.
  const label = compact === 'tablet' ? (collapsed ? 'hidden' : 'hidden lg:inline') : 'inline'
  const initials = userName
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <>
      <Link
        href="/manager/overview"
        className="flex h-16 items-center px-5 text-xl font-bold text-white"
        aria-label="PitchUp, overview"
      >
        <span className={label}>PitchUp</span>
        <span
          aria-hidden="true"
          className={label === 'inline' ? 'hidden' : collapsed ? '' : 'lg:hidden'}
        >
          P
        </span>
      </Link>
      <nav aria-label="Manager" className="flex-1 overflow-y-auto px-2">
        {SECTIONS.map((section, i) => (
          <div key={i} className="mt-2">
            {section.title && (
              <p
                className={`px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 ${label}`}
              >
                {section.title}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map(item => {
                const Icon = item.icon
                const active = !!item.href && item.href === sectionOf(pathname)
                const body = (
                  <>
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className={label}>{item.label}</span>
                    {!item.href && (
                      <span
                        className={`ml-auto rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-300 ${label}`}
                      >
                        Soon
                      </span>
                    )}
                  </>
                )
                return (
                  <li key={item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={item.label}
                        className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium ${
                          active
                            ? 'bg-primary-600 text-white'
                            : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                        }`}
                      >
                        {body}
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        title={`${item.label} (coming soon)`}
                        className="flex h-10 cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm font-medium text-neutral-400"
                      >
                        {body}
                        <span className="sr-only">, coming soon</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-neutral-800 p-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-white"
          >
            {initials}
          </span>
          <span className={`min-w-0 ${label}`}>
            <span className="block truncate text-sm font-medium text-white">{userName}</span>
            <span className="inline-block rounded-full bg-primary-100 px-2 text-[11px] font-medium text-primary-700">
              Manager
            </span>
          </span>
        </div>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="mt-3 hidden w-full items-center justify-center rounded-md py-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white lg:flex"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </>
  )
}

/** The bell: the unread count, and the latest notifications in a dropdown. */
function Notifications() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => send<NotificationPage>('/api/v1/notifications?limit=6', 'GET'),
  })
  const unread = q.data?.unread ?? 0

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
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
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
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg">
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
          {q.data?.items.length ? (
            <ul className="max-h-80 overflow-y-auto">
              {q.data.items.map(n => (
                <li
                  key={n.id}
                  className={`border-b border-neutral-100 px-4 py-2 last:border-b-0 ${n.isRead ? '' : 'bg-primary-50'}`}
                >
                  <p className={`text-sm text-neutral-900 ${n.isRead ? '' : 'font-semibold'}`}>
                    {n.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-neutral-600">{n.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">All caught up</p>
          )}
        </div>
      )}
    </div>
  )
}

function AccountMenu({
  userName,
  signOutAction,
}: {
  userName: string
  signOutAction: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])
  const initials = userName
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${userName}`}
        className="flex h-11 w-11 items-center justify-center rounded-full"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
          {initials}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <p className="truncate px-4 py-2 text-xs text-neutral-500">{userName}</p>
          <Link
            role="menuitem"
            href="/discover"
            className="block px-4 py-2 text-sm hover:bg-neutral-50"
          >
            View Discover
          </Link>
          <form action={signOutAction}>
            <button
              role="menuitem"
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-error-600 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
