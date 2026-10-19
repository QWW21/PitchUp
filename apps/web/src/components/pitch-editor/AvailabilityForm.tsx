'use client'

/**
 * Availability tab — E10-10. The pitch's own week, inside the venue's hours
 * (a day the venue is closed stays closed), and blocked dates, which are
 * saved as soon as they are added or removed.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X } from 'lucide-react'
import {
  DAY_LONG,
  formatDateLong,
  pitchDayError,
  venueClock,
  type DayHours,
  type ManagerPitch,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'
import { SaveBar } from './SaveBar'
import { useEditorForm } from './useForm'

/** Monday first, as people read a week. */
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const TIMES = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
)

export function AvailabilityForm({ pitch }: { pitch: ManagerPitch }) {
  const venue = pitch.venueHours
  const f = useEditorForm<DayHours[]>(pitch.workingHours ?? venue)
  const errors = new Map(
    f.values.map(d => [d.day, pitchDayError(d, venue[d.day]!)] as const).filter(([, e]) => e)
  )
  const sameTime = f.values.some(d => !d.isClosed && d.openTime === d.closeTime)
  const update = (day: number, patch: Partial<DayHours>) =>
    f.setValues(week => week.map(d => (d.day === day ? { ...d, ...patch } : d)))

  return (
    <div className="mt-4 space-y-6">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-neutral-900">Opening hours</h3>
        <p className="mt-1 text-sm text-neutral-500">
          A pitch can open less than the venue, never more. A closing time before the opening time
          means closing after midnight.
        </p>
        <ul className="mt-4 divide-y divide-neutral-100">
          {ORDER.map(day => {
            const d = f.values.find(x => x.day === day)!
            const v = venue[day]!
            const name = DAY_LONG[day]
            const error = errors.get(day)
            return (
              <li key={day} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-24 text-sm font-medium text-neutral-700">{name}</span>
                <label
                  className={`flex items-center gap-2 text-sm ${v.isClosed ? 'text-neutral-400' : 'text-neutral-700'}`}
                >
                  <input
                    type="checkbox"
                    role="switch"
                    checked={d.isClosed || v.isClosed}
                    disabled={v.isClosed}
                    onChange={e => update(day, { isClosed: e.target.checked })}
                    className="h-4 w-4 accent-primary-600"
                  />
                  Closed
                </label>
                {!d.isClosed && !v.isClosed && (
                  <span className="flex items-center gap-2">
                    <select
                      aria-label={`${name} opens`}
                      value={d.openTime}
                      onChange={e => update(day, { openTime: e.target.value })}
                      className="h-10 rounded-md border border-neutral-200 bg-white px-2 text-sm"
                    >
                      {TIMES.map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <span aria-hidden="true">–</span>
                    <select
                      aria-label={`${name} closes`}
                      aria-invalid={!!error || undefined}
                      value={d.closeTime}
                      onChange={e => update(day, { closeTime: e.target.value })}
                      className={`h-10 rounded-md border bg-white px-2 text-sm ${error ? 'border-error-500' : 'border-neutral-200'}`}
                    >
                      {TIMES.map(t => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </span>
                )}
                <span className="text-xs text-neutral-500">
                  (Venue: {v.isClosed ? 'closed' : `${v.openTime}–${v.closeTime}`})
                </span>
                {error && <p className="w-full text-sm text-error-600">{error}</p>}
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={() => f.setValues(venue)}
          className="mt-2 text-sm font-semibold text-primary-700 hover:underline"
        >
          Copy the venue&rsquo;s hours
        </button>
        <SaveBar
          label="Save availability"
          dirty={f.dirty}
          busy={f.busy}
          saved={f.saved}
          error={f.error ?? (sameTime ? 'Closing time must differ from opening time' : null)}
          disabled={errors.size > 0 || sameTime}
          onSave={() =>
            void f.save(`/api/v1/pitches/${pitch.id}/availability`, 'PUT', {
              workingHours: f.values.map(d =>
                venue[d.day]!.isClosed ? { ...d, isClosed: true } : d
              ),
            })
          }
          onReset={f.reset}
        />
      </div>
      <BlockedDates pitchId={pitch.id} exceptions={pitch.exceptions} />
    </div>
  )
}

function BlockedDates({
  pitchId,
  exceptions,
}: {
  pitchId: string
  exceptions: ManagerPitch['exceptions']
}) {
  const router = useRouter()
  const today = venueClock(new Date()).date
  const [list, setList] = useState(exceptions)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) return setError('Choose a date')
    setBusy(true)
    setError(null)
    try {
      const row = await send<ManagerPitch['exceptions'][number]>(
        `/api/v1/pitches/${pitchId}/exceptions`,
        'POST',
        { date, reason }
      )
      setList(l => [...l, row].sort((a, b) => a.date.localeCompare(b.date)))
      setDate('')
      setReason('')
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const remove = async (id: string) => {
    setError(null)
    try {
      await send(`/api/v1/pitches/${pitchId}/exceptions/${id}`, 'DELETE')
      setList(l => l.filter(x => x.id !== id))
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  return (
    <section aria-labelledby="blocked-heading" className="rounded-xl bg-white p-5 shadow-sm">
      <h3 id="blocked-heading" className="text-base font-semibold text-neutral-900">
        Blocked dates
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        Days the pitch is closed: maintenance, holidays, events. Saved straight away.
      </p>
      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="block-date" className="block text-sm font-medium text-neutral-900">
            Date
          </label>
          <input
            id="block-date"
            type="date"
            min={today}
            value={date}
            onChange={e => setDate(e.target.value)}
            className="mt-1 h-10 rounded-md border border-neutral-200 px-3 text-sm"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="block-reason" className="block text-sm font-medium text-neutral-900">
            Reason <span className="font-normal text-neutral-500">(optional)</span>
          </label>
          <input
            id="block-reason"
            value={reason}
            maxLength={200}
            onChange={e => setReason(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-neutral-200 px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No blocked dates.</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100">
          {list.map(x => {
            const past = x.date < today
            return (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                <span className={past ? 'text-neutral-400' : 'text-neutral-900'}>
                  <span className="block text-sm font-medium">{formatDateLong(x.date)}</span>
                  {x.reason && <span className="block text-sm text-neutral-500">{x.reason}</span>}
                </span>
                {!past && (
                  <button
                    type="button"
                    aria-label={`Unblock ${formatDateLong(x.date)}`}
                    onClick={() => void remove(x.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-error-600 hover:bg-error-50"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
