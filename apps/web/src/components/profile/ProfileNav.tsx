'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/profile', label: 'Overview' },
  { href: '/profile/settings', label: 'Account settings' },
  { href: '/profile/change-password', label: 'Change password' },
  { href: '/profile/trust-score', label: 'Trust score' },
  { href: '/profile/payment-methods', label: 'Payment methods' },
  { href: '/profile/delete-account', label: 'Delete account' },
]

export function ProfileNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Profile" className="md:w-[200px] md:shrink-0">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
        {LINKS.map(l => {
          const active = pathname === l.href
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? 'bg-primary-600 text-white'
                    : l.href.endsWith('delete-account')
                      ? 'text-error-600 hover:bg-error-50'
                      : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {l.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
