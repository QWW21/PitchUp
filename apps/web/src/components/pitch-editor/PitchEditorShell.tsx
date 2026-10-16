'use client'

/**
 * Tabs down the side on wide screens, across the top on narrow ones
 * (UIUX_SPEC §14.2). The open tab shows an orange dot while it has unsaved
 * changes; the forms report that through useUnsaved().
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const TABS = [
  ['basic-info', 'Basic info'],
  ['photos', 'Photos'],
  ['amenities', 'Amenities'],
  ['pricing', 'Pricing'],
  ['shirts', 'Shirts'],
  ['availability', 'Availability'],
] as const

const UnsavedContext = createContext<(dirty: boolean) => void>(() => undefined)

/** Tells the tab bar whether the open form has unsaved changes. */
export function useUnsaved(dirty: boolean) {
  const set = useContext(UnsavedContext)
  useEffect(() => {
    set(dirty)
    return () => set(false)
  }, [dirty, set])
}

export function PitchEditorShell({ pitchId, children }: { pitchId: string; children: ReactNode }) {
  const pathname = usePathname()
  const [dirty, setDirty] = useState(false)
  const base = `/manager/pitches/${pitchId}/edit`

  return (
    <div className="mt-6 flex flex-col gap-6 lg:flex-row">
      <nav aria-label="Pitch editor" className="shrink-0 lg:w-[200px]">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {TABS.map(([slug, label]) => {
            const href = `${base}/${slug}`
            const active = pathname === href
            return (
              <li key={slug} className="shrink-0">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                    active ? 'bg-primary-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {label}
                  {active && dirty && (
                    <>
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent-500" />
                      <span className="sr-only">(unsaved changes)</span>
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <UnsavedContext.Provider value={setDirty}>{children}</UnsavedContext.Provider>
      </div>
    </div>
  )
}
