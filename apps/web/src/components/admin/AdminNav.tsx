'use client'

/**
 * The admin panel's navigation — E15-06: down the side on wide screens,
 * across the top (scrolling) on narrow ones.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Gauge, MessageSquareWarning, Scale, Settings, Users } from 'lucide-react'

const ITEMS = [
  { href: '/admin', label: 'Overview', icon: Gauge },
  { href: '/admin/companies', label: 'Venues', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/disputes', label: 'Disputes', icon: Scale },
  { href: '/admin/reviews', label: 'Reviews', icon: MessageSquareWarning },
  { href: '/admin/config', label: 'Settings', icon: Settings },
]

export function AdminNav({ alerts }: { alerts: Record<string, number> }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
          const count = alerts[href] ?? 0
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                  active
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {count > 0 && (
                  <span className="ml-auto rounded-full bg-error-600 px-1.5 text-xs font-semibold text-white">
                    {count}
                    <span className="sr-only"> waiting</span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
