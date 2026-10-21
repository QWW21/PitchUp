'use client'

/**
 * Pricing tab — E10-08 with C-2: one hourly rate at any time of day, the
 * shortest and longest booking, and how far ahead players can book. The
 * preview prices a booking the way checkout does (bookingPrice).
 *
 * C-14: a covered season's prices (cold air, hot air or both) save with the
 * rest; its dates are saved as soon as they are added or removed, like
 * blocked dates.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { X } from 'lucide-react'
import {
  PRICING_OPTIONS,
  PitchPricingSchema,
  bookingPrice,
  formatDateLong,
  formatShortDuration,
  venueClock,
  type ManagerPitch,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'
import { Choice } from './BasicInfoForm'
import { SaveBar } from './SaveBar'
import { useEditorForm } from './useForm'
import { useLocale, useT } from '@/i18n/client'
import { MARK } from '@/i18n/rich'

const AIRS = [
  ['COLD', 'coldOn', 'coldRate'],
  ['HOT', 'hotOn', 'hotRate'],
] as const

export function PricingForm({ pitch }: { pitch: ManagerPitch }) {
  const t = useT()
  const f = useEditorForm({
    hourlyRate: pitch.hourlyRate > 0 ? String(pitch.hourlyRate) : '',
    minBookingHours: pitch.minBookingHours,
    maxBookingHours: pitch.maxBookingHours,
    advanceBookingDays: pitch.advanceBookingDays,
    coldOn: pitch.coveredColdRate !== null,
    coldRate: pitch.coveredColdRate === null ? '' : String(pitch.coveredColdRate),
    hotOn: pitch.coveredHotRate !== null,
    hotRate: pitch.coveredHotRate === null ? '' : String(pitch.coveredHotRate),
  })
  const v = f.values
  const set = (patch: Partial<typeof v>) => f.setValues(prev => ({ ...prev, ...patch }))
  const parsed = PitchPricingSchema.safeParse({
    hourlyRate: Number(v.hourlyRate) || 0,
    minBookingHours: v.minBookingHours,
    maxBookingHours: v.maxBookingHours,
    advanceBookingDays: v.advanceBookingDays,
    coveredColdRate: v.coldOn ? Number(v.coldRate) || 0 : null,
    coveredHotRate: v.hotOn ? Number(v.hotRate) || 0 : null,
  })
  const problem = parsed.success
    ? null
    : t.text(parsed.error.issues[0]?.message ?? t('editor.basic.checkForm'))
  const rate = Number(v.hourlyRate) || 0
  const preview = bookingPrice(rate, Math.max(v.minBookingHours, 2) * 60)
  const covered = AIRS.filter(([, on, r]) => v[on] && Number(v[r]) > 0)

  return (
    <div className="mt-4 space-y-6">
      <div className="space-y-6 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="hourly-rate" className="block text-sm font-medium text-neutral-900">
            {t('editor.pricing.rate')}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="hourly-rate"
              type="number"
              inputMode="decimal"
              min={1}
              max={9999}
              value={v.hourlyRate}
              onChange={e => set({ hourlyRate: e.target.value })}
              aria-describedby="rate-note"
              className="h-11 w-40 rounded-md border border-neutral-200 px-3 text-base"
            />
            <span className="text-sm text-neutral-700">{t('editor.pricing.perHour')}</span>
          </div>
          <p id="rate-note" className="mt-1 text-xs text-neutral-500">
            {t('editor.pricing.rateNote')}
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-neutral-900">
            {t('editor.pricing.covered')}
          </legend>
          <p className="mt-1 text-xs text-neutral-500">{t('editor.pricing.coveredHint')}</p>
          <div className="mt-2 space-y-2">
            {AIRS.map(([air, on, r]) => (
              <div key={air} className="flex min-h-10 flex-wrap items-center gap-3">
                <label className="flex w-28 items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={v[on]}
                    onChange={e => set({ [on]: e.target.checked })}
                    className="h-4 w-4 accent-primary-600"
                  />
                  {t(`air.${air}`)}
                </label>
                {v[on] && (
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={9999}
                      aria-label={t('editor.pricing.airRate', { air: t(`air.${air}`) })}
                      value={v[r]}
                      onChange={e => set({ [r]: e.target.value })}
                      className="h-10 w-32 rounded-md border border-neutral-200 px-3 text-base"
                    />
                    <span className="text-sm text-neutral-700">{t('editor.pricing.perHour')}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <Radios
          legend={t('editor.pricing.shortest')}
          name="min"
          options={PRICING_OPTIONS.MIN_BOOKING_HOURS.map(h => [h, formatShortDuration(h * 60)])}
          value={v.minBookingHours}
          onChange={minBookingHours => set({ minBookingHours })}
        />
        <Radios
          legend={t('editor.pricing.longest')}
          name="max"
          options={PRICING_OPTIONS.MAX_BOOKING_HOURS.map(h => [h, formatShortDuration(h * 60)])}
          value={v.maxBookingHours}
          onChange={maxBookingHours => set({ maxBookingHours })}
        />
        <Radios
          legend={t('editor.pricing.ahead')}
          name="advance"
          options={PRICING_OPTIONS.ADVANCE_BOOKING_DAYS.map(d => [
            d,
            t('editor.pricing.daysAhead', { n: d }),
          ])}
          value={v.advanceBookingDays}
          onChange={advanceBookingDays => set({ advanceBookingDays })}
        />

        <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700" aria-live="polite">
          {rate > 0
            ? (() => {
                const [a, b = '', c = ''] = t('editor.pricing.preview', {
                  duration: MARK,
                  total: MARK,
                  payout: preview.venuePayout,
                }).split(MARK)
                return (
                  <>
                    {a}
                    <strong>{formatShortDuration(preview.minutes)}</strong>
                    {b}
                    <strong>{t('editor.pricing.total', { n: preview.total })}</strong>
                    {c}
                  </>
                )
              })()
            : t('editor.pricing.enterRate')}
          {covered.map(([air, , r]) => (
            <span key={air} className="mt-1 block">
              {t('editor.pricing.coveredPreview', {
                air: t(`air.${air}`).toLowerCase(),
                total: bookingPrice(Number(v[r]), preview.minutes).total,
                duration: formatShortDuration(preview.minutes),
              })}
            </span>
          ))}
        </p>

        <SaveBar
          label={t('editor.pricing.save')}
          dirty={f.dirty}
          busy={f.busy}
          saved={f.saved}
          error={f.error ?? (f.dirty ? problem : null)}
          disabled={!parsed.success}
          onSave={() =>
            parsed.success && void f.save(`/api/v1/pitches/${pitch.id}/pricing`, 'PUT', parsed.data)
          }
          onReset={f.reset}
        />
      </div>
      <CoveredSeasons
        pitchId={pitch.id}
        seasons={pitch.coveredSeasons}
        hasAir={pitch.coveredColdRate !== null || pitch.coveredHotRate !== null}
      />
    </div>
  )
}

function CoveredSeasons({
  pitchId,
  seasons,
  hasAir,
}: {
  pitchId: string
  seasons: ManagerPitch['coveredSeasons']
  /** Saved covered prices; a season needs at least one. */
  hasAir: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const today = venueClock(new Date()).date
  const [list, setList] = useState(seasons)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!from || !to) return setError(t('editor.pricing.chooseDates'))
    setBusy(true)
    setError(null)
    try {
      const row = await send<ManagerPitch['coveredSeasons'][number]>(
        `/api/v1/pitches/${pitchId}/covered-seasons`,
        'POST',
        { startDate: from, endDate: to }
      )
      setList(l => [...l, row].sort((a, b) => a.startDate.localeCompare(b.startDate)))
      setFrom('')
      setTo('')
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  const remove = async (id: string) => {
    setError(null)
    try {
      await send(`/api/v1/pitches/${pitchId}/covered-seasons/${id}`, 'DELETE')
      setList(l => l.filter(x => x.id !== id))
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  const range = (s: { startDate: string; endDate: string }) => ({
    from: formatDateLong(s.startDate, locale),
    to: formatDateLong(s.endDate, locale),
  })

  return (
    <section aria-labelledby="seasons-heading" className="rounded-xl bg-white p-5 shadow-sm">
      <h3 id="seasons-heading" className="text-base font-semibold text-neutral-900">
        {t('editor.pricing.seasons')}
      </h3>
      <p className="mt-1 text-sm text-neutral-500">{t('editor.pricing.seasonsHint')}</p>
      {hasAir ? (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="season-from" className="block text-sm font-medium text-neutral-900">
              {t('editor.pricing.from')}
            </label>
            <input
              id="season-from"
              type="date"
              min={today}
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="mt-1 h-10 rounded-md border border-neutral-200 px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="season-to" className="block text-sm font-medium text-neutral-900">
              {t('editor.pricing.to')}
            </label>
            <input
              id="season-to"
              type="date"
              min={from || today}
              value={to}
              onChange={e => setTo(e.target.value)}
              className="mt-1 h-10 rounded-md border border-neutral-200 px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {busy ? t('editor.pricing.adding') : t('editor.pricing.add')}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-neutral-700">{t('editor.pricing.seasonsNeedAir')}</p>
      )}
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">{t('editor.pricing.noSeasons')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-100">
          {list.map(x => (
            <li key={x.id} className="flex items-center justify-between gap-3 py-2">
              <span
                className={`text-sm font-medium ${x.endDate < today ? 'text-neutral-400' : 'text-neutral-900'}`}
              >
                {t('editor.pricing.seasonRange', range(x))}
              </span>
              <button
                type="button"
                aria-label={t('editor.pricing.removeSeason', range(x))}
                onClick={() => void remove(x.id)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-error-600 hover:bg-error-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Radios({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: [number, string][]
  value: number
  onChange: (v: number) => void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-neutral-900">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map(([n, label]) => (
          <Choice key={n} name={name} checked={value === n} onChange={() => onChange(n)}>
            {label}
          </Choice>
        ))}
      </div>
    </fieldset>
  )
}
