'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Clock } from 'lucide-react'
import {
  formatDayHours,
  todayStatus,
  venueClock,
  weekdayLong,
  type DayHours,
} from '@pitchup/shared'
import { useLocale, useT } from '@/i18n/client'

/**
 * Today's status with the full week underneath. UIUX_SPEC §6.1.
 *
 * Rendered from the server's clock, then re-evaluated in the browser, so a
 * page cached for a while does not keep saying "Open" after closing time.
 */
export function WorkingHours({ week }: { week: DayHours[] }) {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const status = todayStatus(week, now)
  const today = venueClock(now).day
  // Monday first, as a printed week is read here.
  const order = [1, 2, 3, 4, 5, 6, 0]

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 text-left"
      >
        <Clock className="h-4 w-4 text-neutral-500" aria-hidden="true" />
        {status.kind === 'open' && (
          <span>
            <span className="font-medium text-primary-700">{t('venue.hours.open')}</span>
            <span className="text-neutral-700">
              {t('venue.hours.closesAt', { time: status.closesAt })}
            </span>
          </span>
        )}
        {status.kind === 'opensLater' && (
          <span className="text-neutral-700">
            {t('venue.hours.opensAt', { time: status.opensAt })}
          </span>
        )}
        {status.kind === 'closedToday' && (
          <span className="text-error-600">{t('venue.hours.closedToday')}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <dl className="mt-2 grid max-w-xs grid-cols-[96px_1fr] gap-y-1 pl-6">
          {order.map(d => {
            const day = week[d]!
            const isToday = d === today
            return (
              <div key={d} className="contents">
                <dt className={isToday ? 'font-semibold text-neutral-900' : 'text-neutral-500'}>
                  {weekdayLong(d, locale)}
                </dt>
                <dd
                  className={
                    day.isClosed
                      ? 'text-neutral-500'
                      : isToday
                        ? 'font-semibold text-neutral-900'
                        : 'text-neutral-900'
                  }
                >
                  {formatDayHours(day, locale)}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}
