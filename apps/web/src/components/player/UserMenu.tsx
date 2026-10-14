'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface UserMenuProps {
  name: string
  signOutAction: () => Promise<void>
}

export function UserMenu({ name, signOutAction }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on an outside click or Escape, as a native menu would.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={`Account menu for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-neutral-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
          {initials}
        </span>
        <ChevronDown className="h-4 w-4 text-neutral-500" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <p className="truncate px-4 py-2 text-xs text-neutral-500">{name}</p>
          <Link
            role="menuitem"
            href="/profile"
            className="block px-4 py-2 text-sm hover:bg-neutral-50"
          >
            Profile
          </Link>
          <Link
            role="menuitem"
            href="/bookings"
            className="block px-4 py-2 text-sm hover:bg-neutral-50"
          >
            My Bookings
          </Link>
          <form action={signOutAction}>
            <button
              role="menuitem"
              type="submit"
              className="block w-full px-4 py-2 text-left text-sm text-error-600 hover:bg-neutral-50"
            >
              Logout
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
