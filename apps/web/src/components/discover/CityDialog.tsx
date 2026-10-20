'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Crosshair, Loader2, Search, X } from 'lucide-react'
import { CITIES, foldForSearch } from '@pitchup/shared'
import { useT } from '@/i18n/client'

export type DetectResult = 'detected' | 'denied' | 'error' | 'unsupported'

interface CityDialogProps {
  open: boolean
  selected: string | null
  /** False when no city is chosen yet: the page has nothing to show without one. */
  dismissible: boolean
  onClose: () => void
  onSelect: (city: string) => void
  onDetect: () => Promise<DetectResult>
}

/** City picker: searchable list with a "Detect my location" row. UIUX_SPEC §5.3, E03-08. */
export function CityDialog({
  open,
  selected,
  dismissible,
  onClose,
  onSelect,
  onDetect,
}: CityDialogProps) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setMessage(null)
    inputRef.current?.focus()
    if (!dismissible) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  const filtered = useMemo(
    () => CITIES.filter(c => foldForSearch(c.name).includes(foldForSearch(query.trim()))),
    [query]
  )

  if (!open) return null

  async function detect() {
    setDetecting(true)
    setMessage(null)
    const result = await onDetect()
    setDetecting(false)
    if (result !== 'detected') setMessage(t(`discover.city.${result}`))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-dialog-title"
        onClick={e => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-w-md sm:rounded-xl"
      >
        <div className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
          <h2 id="city-dialog-title" className="text-xl font-semibold text-neutral-900">
            {dismissible ? t('discover.city.select') : t('discover.city.where')}
          </h2>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-neutral-100"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="px-4 py-2">
          <div className="flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4">
            <Search className="h-4 w-4 text-neutral-500" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('discover.city.search')}
              aria-label={t('discover.city.searchLabel')}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-500"
            />
          </div>
        </div>

        <div className="overflow-y-auto">
          <button
            type="button"
            onClick={detect}
            disabled={detecting}
            className="flex h-14 w-full items-center gap-3 border-b border-neutral-100 px-4 text-left text-primary-600 hover:bg-neutral-50"
          >
            {detecting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Crosshair className="h-5 w-5" aria-hidden="true" />
            )}
            {t('discover.city.detect')}
          </button>
          {message && (
            <p role="alert" className="px-4 py-2 text-sm text-error-600">
              {message}
            </p>
          )}

          <p className="bg-neutral-50 px-4 pb-1 pt-3 text-[11px] font-medium uppercase text-neutral-500">
            {t('discover.city.country')}
          </p>
          {filtered.length === 0 ? (
            <p className="px-4 pt-10 text-center text-sm text-neutral-500">
              {t('discover.city.noneFound', { query })}
            </p>
          ) : (
            <ul>
              {filtered.map(city => (
                <li key={city.name}>
                  <button
                    type="button"
                    onClick={() => onSelect(city.name)}
                    className="flex min-h-14 w-full items-center border-b border-neutral-100 px-4 py-2 text-left hover:bg-neutral-50"
                  >
                    <span className="flex-1">
                      <span className="block text-base text-neutral-900">{city.name}</span>
                      <span className="block text-xs text-neutral-500">{city.county}</span>
                    </span>
                    {city.name === selected && (
                      <Check
                        className="h-5 w-5 text-primary-600"
                        aria-label={t('discover.city.selected')}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
