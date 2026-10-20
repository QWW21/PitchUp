'use client'

/**
 * The admin panel's navigation — E15-06: down the side on wide screens,
 * across the top (scrolling) on narrow ones.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, Gauge, MessageSquareWarning, Scale, Settings, Users } from 'lucide-react'
import { useT } from '@/i18n/client'

const ITEMS = [
  { href: '/admin', label: 'overview', icon: Gauge },
  { href: '/admin/companies', label: 'companies', icon: Building2 },
  { href: '/admin/users', label: 'users', icon: Users },
  { href: '/admin/disputes', label: 'disputes', icon: Scale },
  { href: '/admin/reviews', label: 'reviews', icon: MessageSquareWarning },
  { href: '/admin/config', label: 'config', icon: Settings },
] as const

export function AdminNav({ alerts }: { alerts: Record<string, number> }) {
  const t = useT()
  const pathname = usePathname()
  return (
    <nav aria-label={t('admin.nav.label')}>
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
                {t(`admin.nav.${label}`)}
                {count > 0 && (
                  <span className="ml-auto rounded-full bg-error-600 px-1.5 text-xs font-semibold text-white">
                    {count}
                    <span className="sr-only">{t('admin.nav.waiting')}</span>
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
