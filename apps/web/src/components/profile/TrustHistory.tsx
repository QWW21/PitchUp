'use client'

/**
 * The trust score's history, newest first and grouped by month. The first
 * page comes from the server; the next ones load when the end of the list
 * scrolls into view (or from the button). Events about a booking link to it.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { INTL_LOCALE, capitalise, type TrustEvent, type TrustScoreDetail } from '@pitchup/shared'
import { send } from '@/lib/http'
import { useLocale, useT } from '@/i18n/client'

export function TrustHistory({
  initial,
  nextCursor: firstCursor,
}: {
  initial: TrustEvent[]
  nextCursor: string | null
}) {
  const t = useT()
  const locale = useLocale()
  const month = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Bucharest',
  })
  const day = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Bucharest',
  })
  const [events, setEvents] = useState(initial)
  const [cursor, setCursor] = useState(firstCursor)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)

  const more = async () => {
    if (!cursor || busy) return
    setBusy(true)
    setError(null)
    try {
      const page = await send<TrustScoreDetail>(
        `/api/v1/profile/trust-score?cursor=${cursor}`,
        'GET'
      )
      setEvents(list => [...list, ...page.events])
      setCursor(page.nextCursor)
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  useEffect(() => {
    const el = end.current
    if (!el || !cursor || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void more()
    })
    io.observe(el)
    return () => io.disconnect()
  })

  if (!events.length) {
    return <p className="mt-2 text-sm text-neutral-500">{t('profile.trust.noEvents')}</p>
  }

  const groups: { label: string; items: TrustEvent[] }[] = []
  for (const e of events) {
    const label = capitalise(month.format(new Date(e.createdAt)))
    const last = groups.at(-1)
    if (last?.label === label) last.items.push(e)
    else groups.push({ label, items: [e] })
  }

  return (
    <div className="mt-2">
      {groups.map(g => (
        <div key={g.label}>
          <h3 className="pb-1 pt-3 text-xs font-medium uppercase text-neutral-500">{g.label}</h3>
          <ul>
            {g.items.map(e => {
              const row = (
                <>
                  <span
                    className={`inline-flex h-7 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      e.delta >= 0 ? 'bg-primary-50 text-primary-700' : 'bg-error-50 text-error-600'
                    }`}
                  >
                    {e.delta > 0 ? `+${e.delta}` : `−${Math.abs(e.delta)}`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-neutral-900">{e.label}</span>
                    <span className="block text-xs text-neutral-500">
                      {day.format(new Date(e.createdAt))}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={e.id} className="border-b border-neutral-100 last:border-b-0">
                  {e.bookingId ? (
                    <Link
                      href={`/my-bookings/${e.bookingId}`}
                      className="flex items-center gap-3 py-2 hover:bg-neutral-50"
                    >
                      {row}
                      <ChevronRight className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 py-2">{row}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {error && (
        <p role="alert" className="mt-2 text-sm text-error-600">
          {error}
        </p>
      )}
      {cursor && (
        <div ref={end} className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => void more()}
            disabled={busy}
            className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
          >
            {busy ? t('profile.trust.loading') : t('profile.trust.older')}
          </button>
        </div>
      )}
    </div>
  )
}
