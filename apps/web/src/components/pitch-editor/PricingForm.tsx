'use client'

/**
 * Pricing tab — E10-08 with C-2: one hourly rate at any time of day, the
 * shortest and longest booking, and how far ahead players can book. The
 * preview prices a booking the way checkout does (bookingPrice).
 */
import {
  PRICING_OPTIONS,
  PitchPricingSchema,
  bookingPrice,
  type ManagerPitch,
} from '@pitchup/shared'
import { Choice } from './BasicInfoForm'
import { SaveBar } from './SaveBar'
import { useEditorForm } from './useForm'

export function PricingForm({ pitch }: { pitch: ManagerPitch }) {
  const f = useEditorForm({
    hourlyRate: pitch.hourlyRate > 0 ? String(pitch.hourlyRate) : '',
    minBookingHours: pitch.minBookingHours,
    maxBookingHours: pitch.maxBookingHours,
    advanceBookingDays: pitch.advanceBookingDays,
  })
  const v = f.values
  const set = (patch: Partial<typeof v>) => f.setValues(prev => ({ ...prev, ...patch }))
  const parsed = PitchPricingSchema.safeParse({ ...v, hourlyRate: Number(v.hourlyRate) || 0 })
  const problem = parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Check the form')
  const rate = Number(v.hourlyRate) || 0
  const preview = bookingPrice(rate, Math.max(v.minBookingHours, 2) * 60)

  return (
    <div className="mt-4 space-y-6 rounded-xl bg-white p-5 shadow-sm">
      <div>
        <label htmlFor="hourly-rate" className="block text-sm font-medium text-neutral-900">
          Hourly rate
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
          <span className="text-sm text-neutral-700">RON / hour</span>
        </div>
        <p id="rate-note" className="mt-1 text-xs text-neutral-500">
          The same price at any time of day. Players pay only this; there is no booking fee.
        </p>
      </div>

      <Radios
        legend="Shortest booking"
        name="min"
        options={PRICING_OPTIONS.MIN_BOOKING_HOURS.map(h => [h, `${h}h`])}
        value={v.minBookingHours}
        onChange={minBookingHours => set({ minBookingHours })}
      />
      <Radios
        legend="Longest booking"
        name="max"
        options={PRICING_OPTIONS.MAX_BOOKING_HOURS.map(h => [h, `${h}h`])}
        value={v.maxBookingHours}
        onChange={maxBookingHours => set({ maxBookingHours })}
      />
      <Radios
        legend="Players can book up to"
        name="advance"
        options={PRICING_OPTIONS.ADVANCE_BOOKING_DAYS.map(d => [d, `${d} days ahead`])}
        value={v.advanceBookingDays}
        onChange={advanceBookingDays => set({ advanceBookingDays })}
      />

      <p className="rounded-md bg-neutral-50 p-3 text-sm text-neutral-700" aria-live="polite">
        {rate > 0 ? (
          <>
            A player booking <strong>{preview.minutes / 60}h</strong> pays{' '}
            <strong>{preview.total} RON</strong>. You receive {preview.venuePayout} RON after
            PitchUp&rsquo;s 8% commission.
          </>
        ) : (
          'Enter an hourly rate to see what a booking costs.'
        )}
      </p>

      <SaveBar
        label="Save pricing"
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
