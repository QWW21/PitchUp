'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/reviews', label: 'Reviews' },
]

export function DashboardNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Dashboard" className="flex gap-1">
      {LINKS.map(l => {
        const active = pathname === l.href
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-md px-2 py-2 text-sm font-medium sm:px-3 ${
              active ? 'bg-primary-50 text-primary-700' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
