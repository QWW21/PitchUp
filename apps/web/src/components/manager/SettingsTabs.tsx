'use client'

/** The Settings tabs — C-13. */
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  ['/manager/settings', 'Bookings and payments'],
  ['/manager/settings/venue', 'Venue details'],
  ['/manager/settings/account', 'Your account'],
] as const

export function SettingsTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Settings" className="mt-4">
      <ul className="flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map(([href, label]) => {
          const active = pathname === href
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-11 items-center border-b-2 px-3 text-sm font-medium ${
                  active
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-neutral-700 hover:text-neutral-900'
                }`}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
