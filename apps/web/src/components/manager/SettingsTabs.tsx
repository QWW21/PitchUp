'use client'

/** The Settings tabs — C-13. */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/i18n/client'

const TABS = [
  ['/manager/settings', 'bookings'],
  ['/manager/settings/venue', 'venue'],
  ['/manager/settings/account', 'account'],
] as const

export function SettingsTabs() {
  const t = useT()
  const pathname = usePathname()
  return (
    <nav aria-label={t('manager.settings.tabs.label')} className="mt-4">
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
                {t(`manager.settings.tabs.${label}`)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
